import { chromium, type Page } from "playwright-core";
import { ensureCloudBrowser, publicPageUrl, redactBrowserError } from "../browser/cloud";
import { canonicalizeUrl } from "../discovery/canonicalize";
import { discoverSources } from "../discovery/run";
import {
  createObservation,
  createSource,
  findSourceByCanonical,
  getInvestigationById,
  listInvestigationSources,
  setInvestigationStatus,
  updateSourceVisit,
} from "../db/queries";
import { classifyVisit, selectCrawlLink, type AccessStatus } from "./classify";
import { crawlUserAgent, readCrawlLimits } from "./limits";
import { finishFieldwork, fieldworkProgress, startFieldworkJob, updateFieldwork } from "./progress";
import { reportOperationFailure, traceOperation } from "../sentry/report";
import { scrubText } from "../sentry/scrub";
import { allowAllRobots, parseRobots, type RobotsRules } from "./robots";

type ExtractedPage = {
  title: string;
  canonical: string;
  description: string;
  headings: string[];
  text: string;
  links: string[];
};

const loginPath = /\/(login|signin|sign-in|signup|sign-up|account|checkout|subscribe|paywall)(\/|$)/i;
const challengeTitle = /captcha|just a moment|attention required|verify you are human|access denied/i;

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  if (ms <= 0 || signal.aborted) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });
}

async function robotsFor(origin: string, cache: Map<string, RobotsRules>, signal: AbortSignal): Promise<RobotsRules> {
  const cached = cache.get(origin);
  if (cached) {
    return cached;
  }
  try {
    const response = await fetch(new URL("/robots.txt", origin), {
      redirect: "follow",
      headers: { "user-agent": crawlUserAgent, accept: "text/plain" },
      signal: AbortSignal.any([signal, AbortSignal.timeout(8_000)]),
    });
    const rules = response.ok ? parseRobots(await response.text(), crawlUserAgent) : allowAllRobots;
    cache.set(origin, rules);
    return rules;
  } catch {
    if (signal.aborted) {
      throw new DOMException("The fieldwork was cancelled.", "AbortError");
    }
    cache.set(origin, allowAllRobots);
    return allowAllRobots;
  }
}

async function readPage(page: Page): Promise<ExtractedPage> {
  return page.evaluate(() => {
    const textOf = (selector: string) =>
      [...document.querySelectorAll(selector)]
        .map((element) => element.textContent?.trim() ?? "")
        .filter(Boolean);
    return {
      title: document.title ?? "",
      canonical: document.querySelector('link[rel="canonical"]')?.getAttribute("href") ?? "",
      description: document.querySelector('meta[name="description"]')?.getAttribute("content") ?? "",
      headings: textOf("h1, h2, h3").slice(0, 30),
      text: (document.body?.innerText ?? "").replace(/[ \t]+\n/g, "\n").trim().slice(0, 12_000),
      links: [...document.querySelectorAll("a[href]")]
        .map((element) => (element as HTMLAnchorElement).href)
        .slice(0, 200),
    };
  });
}

function observationBody(input: {
  accessStatus: AccessStatus;
  text: string;
  headings: string[];
  description: string;
  links: string[];
}): string {
  const lines = [`Navigation result: ${input.accessStatus}.`];
  if (input.accessStatus !== "accessible" && input.accessStatus !== "redirected") {
    lines.push("This result is not classified as deleted.");
  }
  lines.push("", input.text || "No visible text was extracted.");
  if (input.headings.length > 0) {
    lines.push("", "Headings:", ...input.headings.map((heading) => `- ${heading}`));
  }
  if (input.description) {
    lines.push("", `Metadata description: ${input.description.slice(0, 500)}`);
  }
  if (input.links.length > 0) {
    lines.push("", "Outgoing links:", ...input.links.slice(0, 40).map((link) => `- ${link}`));
  }
  return lines.join("\n").slice(0, 20_000);
}

export function runFieldwork(investigationId: string): Promise<void> {
  return traceOperation(
    { name: "Fieldwork", operation: "fieldwork", investigationId },
    () => executeFieldwork(investigationId),
  );
}

async function executeFieldwork(investigationId: string): Promise<void> {
  const limits = readCrawlLimits();
  const signal = startFieldworkJob(investigationId, limits.maxPages);
  const robotsCache = new Map<string, RobotsRules>();
  let pagesVisited = 0;
  let observationsSaved = 0;

  try {
    const investigation = await getInvestigationById(investigationId);
    if (!investigation) {
      throw new Error("Investigation not found.");
    }
    await setInvestigationStatus(investigation.id, "investigating");
    updateFieldwork(investigation.id, { phase: "Searching for public leads" });

    try {
      const discovery = await discoverSources({
        investigationId: investigation.id,
        subject: investigation.subject,
        startingUrl: investigation.startingUrl,
        objective: investigation.objective,
        shouldStop: () => signal.aborted,
      });
      updateFieldwork(investigation.id, {
        sourcesDiscovered: discovery.saved.length,
        errors: discovery.errors.map((error) => error.message),
      });
    } catch (error) {
      updateFieldwork(investigation.id, {
        errors: [error instanceof Error ? error.message : "Search discovery failed."],
      });
    }

    if (signal.aborted) {
      finishFieldwork(investigation.id, "cancelled", "Cancelled before browsing");
      return;
    }

    const storedSources = await listInvestigationSources(investigation.id);
    const allowedHosts = new Set<string>();
    const queue: Array<{ url: string; depth: number }> = [];
    const seen = new Set<string>();

    const enqueue = (value: string, depth: number) => {
      if (depth > limits.maxDepth) {
        return;
      }
      let destination: string;
      try {
        destination = publicPageUrl(value);
      } catch {
        return;
      }
      const canonical = canonicalizeUrl(destination);
      if (!canonical || seen.has(canonical)) {
        return;
      }
      seen.add(canonical);
      allowedHosts.add(new URL(canonical).hostname.replace(/^www\./, ""));
      queue.push({ url: canonical, depth });
    };

    enqueue(investigation.startingUrl, 0);
    for (const source of storedSources) {
      enqueue(source.url, 0);
    }

    if (queue.length === 0) {
      finishFieldwork(investigation.id, "completed", "No public pages were queued");
      return;
    }

    updateFieldwork(investigation.id, { phase: "Opening the cloud browser" });
    const cloud = await ensureCloudBrowser(investigation.id);
    const browser = await chromium.connectOverCDP(cloud.connectUrl, { timeout: 30_000 });

    try {
      const context = browser.contexts()[0];
      if (!context) {
        throw new Error("The cloud browser did not open a page.");
      }
      const page = context.pages()[0] ?? (await context.newPage());
      let firstNavigation = true;

      while (queue.length > 0 && pagesVisited < limits.maxPages) {
        if (signal.aborted) {
          break;
        }
        const item = queue.shift();
        if (!item) {
          break;
        }
        const target = new URL(item.url);
        const robots = await robotsFor(target.origin, robotsCache, signal);
        if (!robots.allowed(target.pathname)) {
          await rememberSource(investigation.id, item.url, "blocked", null);
          updateFieldwork(investigation.id, {
            errors: [
              ...(fieldworkErrors(investigation.id)),
              `Skipped ${target.hostname}${target.pathname} because robots.txt disallows it.`,
            ].slice(-8),
          });
          continue;
        }

        const wait = Math.max(limits.delayMs, robots.crawlDelayMs);
        if (!firstNavigation) {
          updateFieldwork(investigation.id, { phase: `Waiting ${wait} ms before the next page` });
          await sleep(wait, signal);
        }
        firstNavigation = false;
        if (signal.aborted) {
          break;
        }

        updateFieldwork(investigation.id, { phase: "Visiting a public page", currentUrl: item.url });
        const visit = await visitPage(page, item.url);
        pagesVisited += 1;
        try {
          const rememberedUrl = visit.canonical || visit.finalUrl || item.url;
          const source = await rememberSource(investigation.id, rememberedUrl, visit.accessStatus, visit.title);
          const body = observationBody({
            accessStatus: visit.accessStatus,
            text: visit.text,
            headings: visit.headings,
            description: visit.description,
            links: visit.links,
          });
          await createObservation({
            investigationId: investigation.id,
            sourceId: source.id,
            pageTitle: visit.title || null,
            extractedContent: body,
            httpStatus: visit.httpStatus,
            observedAt: new Date(),
          });
          observationsSaved += 1;
        } catch (error) {
          updateFieldwork(investigation.id, {
            errors: [
              ...fieldworkErrors(investigation.id),
              error instanceof Error ? error.message : "The observation could not be stored.",
            ].slice(-8),
          });
        }

        const missing = ["http_404", "http_403", "timeout", "navigation_error"].includes(visit.accessStatus);
        const progress = currentProgress(investigation.id);
        updateFieldwork(investigation.id, {
          pagesVisited,
          observationsSaved,
          missingReferences: missing
            ? [
                ...progress.missingReferences,
                {
                  url: visit.finalUrl || item.url,
                  accessStatus: visit.accessStatus,
                  note: "Potentially missing reference. Not classified as deleted.",
                },
              ].slice(-15)
            : progress.missingReferences,
        });

        if (item.depth < limits.maxDepth) {
          let added = 0;
          for (const link of visit.links) {
            if (added >= 8) {
              break;
            }
            const next = selectCrawlLink(link, visit.finalUrl || item.url, allowedHosts);
            if (!next || seen.has(next)) {
              continue;
            }
            enqueue(next, item.depth + 1);
            added += 1;
          }
        }
      }
    } finally {
      await browser.close().catch(() => undefined);
    }

    finishFieldwork(
      investigation.id,
      signal.aborted ? "cancelled" : "completed",
      signal.aborted ? "Cancelled" : "Fieldwork finished",
    );
  } catch (error) {
    if (signal.aborted) {
      finishFieldwork(investigationId, "cancelled", "Cancelled");
      return;
    }
    updateFieldwork(investigationId, {
      errors: [scrubText(redactBrowserError(error))].slice(-8),
    });
    reportOperationFailure("fieldwork", error, investigationId);
    finishFieldwork(investigationId, "failed", "Fieldwork stopped after an error");
  }
}

function fieldworkErrors(investigationId: string): string[] {
  return fieldworkProgress(investigationId).errors;
}

function currentProgress(investigationId: string) {
  return fieldworkProgress(investigationId);
}

async function rememberSource(
  investigationId: string,
  url: string,
  accessStatus: AccessStatus,
  title: string | null,
) {
  const canonical = canonicalizeUrl(url) ?? url;
  const existing = await findSourceByCanonical(investigationId, canonical);
  if (existing) {
    await updateSourceVisit(existing.id, {
      accessStatus,
      title: title || existing.title,
      url,
      canonicalUrl: canonical,
    });
    return { ...existing, id: existing.id };
  }
  return createSource({
    investigationId,
    url,
    canonicalUrl: canonical,
    title,
    sourceType: "visited_page",
    discoveryMethod: "crawl",
    accessStatus,
  });
}

async function visitPage(page: Page, requestedUrl: string): Promise<{
  accessStatus: AccessStatus;
  httpStatus: number | null;
      finalUrl: string;
  title: string;
  text: string;
  headings: string[];
  description: string;
  links: string[];
  canonical: string;
}> {
  try {
    const response = await page.goto(requestedUrl, { waitUntil: "domcontentloaded", timeout: 25_000 });
    const extracted = await readPage(page);
    const finalUrl = page.url();
    const path = new URL(finalUrl).pathname;
    const blocked = challengeTitle.test(extracted.title) || loginPath.test(path);
    return {
      accessStatus: classifyVisit({
        httpStatus: response?.status() ?? null,
        requestedUrl,
        finalUrl,
        timedOut: false,
        navigationError: false,
        blocked,
      }),
      httpStatus: response?.status() ?? null,
      finalUrl,
      title: extracted.title,
      text: extracted.text,
      headings: extracted.headings,
      description: extracted.description,
      links: extracted.links,
      canonical: extracted.canonical,
    };
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "TimeoutError";
    return {
      accessStatus: classifyVisit({
        httpStatus: null,
        requestedUrl,
        finalUrl: null,
        timedOut,
        navigationError: !timedOut,
        blocked: false,
      }),
      httpStatus: null,
      finalUrl: requestedUrl,
      title: "",
      text: timedOut ? "The navigation timed out before the page could be read." : "The navigation failed before the page could be read.",
      headings: [],
      description: "",
      links: [],
      canonical: "",
    };
  }
}
