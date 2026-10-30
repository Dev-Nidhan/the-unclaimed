import Browserbase from "@browserbasehq/sdk";
import { chromium, type Page } from "playwright-core";
import {
  insertBrowserSession,
  markBrowserSession,
  openBrowserSession,
  setInvestigationStatus,
} from "../db/queries";
import type { BrowserView } from "./types";

export type { BrowserView } from "./types";

const browserRegions = ["us-west-2", "us-east-1", "eu-central-1", "ap-southeast-1"] as const;
type BrowserRegion = (typeof browserRegions)[number];

const liveViewSeconds = 120;

export function redactBrowserError(error: unknown): string {
  const message = error instanceof Error ? error.message : "Browser session failed.";
  return message
    .replace(/wss:\/\/\S+/gi, "[redacted-cdp]")
    .replace(/https?:\/\/[^\s]*browserbase[^\s]*/gi, "[redacted-browser-url]")
    .replace(/signingKey[=:]\S+/gi, "signingKey=[redacted]")
    .replace(/api_key=[^&\s]+/gi, "api_key=[redacted]");
}

function browserbase(): Browserbase {
  const apiKey = process.env.BROWSERBASE_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("BROWSERBASE_API_KEY is not set.");
  }
  return new Browserbase({ apiKey });
}

function projectId(): string | undefined {
  const value = process.env.BROWSERBASE_PROJECT_ID?.trim();
  return value || undefined;
}

function region(): BrowserRegion | undefined {
  const value = process.env.BROWSERBASE_REGION?.trim();
  return browserRegions.find((item) => item === value);
}

export function publicPageUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Enter an http or https address.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Enter an http or https address.");
  }
  const host = url.hostname.toLowerCase();
  const privateHost =
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host === "0.0.0.0" ||
    host.startsWith("127.") ||
    host.startsWith("10.") ||
    host.startsWith("192.168.") ||
    host.startsWith("169.254.");
  if (privateHost) {
    throw new Error("Only public websites can be opened in the cloud browser.");
  }
  return url.toString();
}

async function liveView(browserbaseSessionId: string): Promise<string> {
  const links = await browserbase().sessions.debug(browserbaseSessionId, { expiresIn: liveViewSeconds });
  return links.debuggerFullscreenUrl;
}

async function withPage<T>(connectUrl: string, run: (page: Page) => Promise<T>): Promise<T> {
  const browser = await chromium.connectOverCDP(connectUrl, { timeout: 30_000 });
  try {
    const context = browser.contexts()[0];
    if (!context) {
      throw new Error("The cloud browser did not open a page.");
    }
    const page = context.pages()[0] ?? (await context.newPage());
    return await run(page);
  } finally {
    await browser.close().catch(() => undefined);
  }
}

async function connectUrlFor(browserbaseSessionId: string): Promise<string> {
  const session = await browserbase().sessions.retrieve(browserbaseSessionId);
  if (!session.connectUrl || session.status === "COMPLETED" || session.status === "TIMED_OUT" || session.status === "ERROR") {
    throw new Error("The cloud browser session is no longer running.");
  }
  return session.connectUrl;
}

async function releaseRemote(browserbaseSessionId: string): Promise<void> {
  await browserbase().sessions.update(browserbaseSessionId, {
    status: "REQUEST_RELEASE",
    projectId: projectId(),
  });
}

export async function readBrowserView(investigationId: string): Promise<BrowserView> {
  const record = await openBrowserSession(investigationId);
  if (!record) {
    return { status: "none", pageUrl: null, pageTitle: null, liveViewUrl: null };
  }
  try {
    const connectUrl = await connectUrlFor(record.browserbaseSessionId);
    const page = await withPage(connectUrl, async (current) => ({
      pageUrl: current.url(),
      pageTitle: await current.title(),
    }));
    return {
      status: "active",
      pageUrl: page.pageUrl,
      pageTitle: page.pageTitle,
      liveViewUrl: await liveView(record.browserbaseSessionId),
    };
  } catch (error) {
    await markBrowserSession(record.id, "failed").catch(() => undefined);
    throw error;
  }
}

export async function ensureCloudBrowser(investigationId: string): Promise<{
  recordId: string;
  browserbaseSessionId: string;
  connectUrl: string;
}> {
  const existing = await openBrowserSession(investigationId);
  if (existing) {
    return {
      recordId: existing.id,
      browserbaseSessionId: existing.browserbaseSessionId,
      connectUrl: await connectUrlFor(existing.browserbaseSessionId),
    };
  }

  const created = await browserbase().sessions.create({
    keepAlive: true,
    api_timeout: 600,
    projectId: projectId(),
    region: region(),
  });
  try {
    const record = await insertBrowserSession(investigationId, created.id);
    await markBrowserSession(record.id, "active");
    return { recordId: record.id, browserbaseSessionId: created.id, connectUrl: created.connectUrl };
  } catch (error) {
    await releaseRemote(created.id).catch(() => undefined);
    throw error;
  }
}

export async function startBrowserSession(investigationId: string, startingUrl: string): Promise<BrowserView> {
  const existing = await openBrowserSession(investigationId);
  if (existing) {
    return readBrowserView(investigationId);
  }

  const created = await browserbase().sessions.create({
    keepAlive: true,
    api_timeout: 300,
    projectId: projectId(),
    region: region(),
  });
  let record;
  try {
    record = await insertBrowserSession(investigationId, created.id);
  } catch (error) {
    await releaseRemote(created.id).catch(() => undefined);
    throw error;
  }

  try {
    const destination = publicPageUrl(startingUrl);
    const page = await withPage(created.connectUrl, async (current) => {
      await current.goto(destination, { waitUntil: "domcontentloaded", timeout: 30_000 });
      return { pageUrl: current.url(), pageTitle: await current.title() };
    });
    await markBrowserSession(record.id, "active");
    return {
      status: "active",
      pageUrl: page.pageUrl,
      pageTitle: page.pageTitle,
      liveViewUrl: await liveView(created.id),
    };
  } catch (error) {
    await markBrowserSession(record.id, "failed").catch(() => undefined);
    await releaseRemote(created.id).catch(() => undefined);
    throw error;
  }
}

export async function navigateBrowser(investigationId: string, url: string): Promise<BrowserView> {
  const destination = publicPageUrl(url);
  const record = await openBrowserSession(investigationId);
  if (!record) {
    return startBrowserSession(investigationId, destination);
  }
  const connectUrl = await connectUrlFor(record.browserbaseSessionId);
  const page = await withPage(connectUrl, async (current) => {
    await current.goto(destination, { waitUntil: "domcontentloaded", timeout: 30_000 });
    return { pageUrl: current.url(), pageTitle: await current.title() };
  });
  return {
    status: "active",
    pageUrl: page.pageUrl,
    pageTitle: page.pageTitle,
    liveViewUrl: await liveView(record.browserbaseSessionId),
  };
}

async function historyAction(
  investigationId: string,
  action: "back" | "forward" | "reload",
): Promise<BrowserView> {
  const record = await openBrowserSession(investigationId);
  if (!record) {
    throw new Error("Start a cloud browser session before using the navigation controls.");
  }
  const connectUrl = await connectUrlFor(record.browserbaseSessionId);
  const page = await withPage(connectUrl, async (current) => {
    if (action === "back") {
      await current.goBack({ waitUntil: "domcontentloaded", timeout: 30_000 });
    } else if (action === "forward") {
      await current.goForward({ waitUntil: "domcontentloaded", timeout: 30_000 });
    } else {
      await current.reload({ waitUntil: "domcontentloaded", timeout: 30_000 });
    }
    return { pageUrl: current.url(), pageTitle: await current.title() };
  });
  return {
    status: "active",
    pageUrl: page.pageUrl,
    pageTitle: page.pageTitle,
    liveViewUrl: await liveView(record.browserbaseSessionId),
  };
}

export function goBack(investigationId: string): Promise<BrowserView> {
  return historyAction(investigationId, "back");
}

export function goForward(investigationId: string): Promise<BrowserView> {
  return historyAction(investigationId, "forward");
}

export function reloadBrowser(investigationId: string): Promise<BrowserView> {
  return historyAction(investigationId, "reload");
}

export async function stopBrowserSession(investigationId: string): Promise<BrowserView> {
  const record = await openBrowserSession(investigationId);
  if (!record) {
    return { status: "closed", pageUrl: null, pageTitle: null, liveViewUrl: null };
  }
  await releaseRemote(record.browserbaseSessionId);
  await markBrowserSession(record.id, "closed");
  return { status: "closed", pageUrl: null, pageTitle: null, liveViewUrl: null };
}

export async function completeInvestigation(investigationId: string): Promise<BrowserView> {
  const view = await stopBrowserSession(investigationId);
  await setInvestigationStatus(investigationId, "closed");
  return view;
}
