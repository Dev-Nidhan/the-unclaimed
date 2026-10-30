import { connection } from "next/server";
import { classifyVisit } from "../archaeology/classify";
import {
  createInvestigation,
  createObservation,
  createSource,
  findInvestigationByStartingUrl,
  findSourceByCanonical,
  investigationHasObservation,
  updateSourceVisit,
} from "../db/queries";
import { investigationScenarios } from "./scenarios";

function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

export function readablePage(html: string): { title: string | null; text: string } {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? decodeEntities(titleMatch[1]).replace(/\s+/g, " ").trim() : null;
  const text = decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 12000);
  return { title: title || null, text };
}

async function readPublicPage(url: string): Promise<{
  finalUrl: string;
  httpStatus: number;
  title: string | null;
  text: string;
}> {
  const response = await fetch(url, {
    redirect: "follow",
    signal: AbortSignal.timeout(20000),
    headers: { accept: "text/html", "user-agent": "TheUnclaimedArchaeology/1.0" },
  });
  const html = await response.text();
  const page = readablePage(html);
  if (!page.text) {
    throw new Error("The starter page returned no readable text.");
  }
  return {
    finalUrl: response.url || url,
    httpStatus: response.status,
    title: page.title,
    text: page.text,
  };
}

let starterGate: Promise<unknown> = Promise.resolve();

export async function ensureStarterInvestigation(): Promise<string> {
  const run = starterGate.then(() => createStarterInvestigation(), () => createStarterInvestigation());
  starterGate = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

async function createStarterInvestigation(): Promise<string> {
  await connection();
  const scenario = investigationScenarios[0];
  if (!scenario) {
    throw new Error("No starter investigation is configured.");
  }

  let investigation = await findInvestigationByStartingUrl(scenario.startingUrl);
  if (!investigation) {
    const address = new URL(scenario.startingUrl);
    investigation = await createInvestigation({
      title: scenario.title,
      subject: address.hostname,
      startingUrl: scenario.startingUrl,
      objective: scenario.objective,
    });
  }
  if (await investigationHasObservation(investigation.id)) {
    return investigation.id;
  }

  const page = await readPublicPage(scenario.startingUrl);
  const accessStatus = classifyVisit({
    httpStatus: page.httpStatus,
    requestedUrl: scenario.startingUrl,
    finalUrl: page.finalUrl,
    timedOut: false,
    navigationError: page.httpStatus >= 400,
    blocked: false,
  });
  const existingSource =
    (await findSourceByCanonical(investigation.id, page.finalUrl)) ??
    (await findSourceByCanonical(investigation.id, scenario.startingUrl));
  const source =
    existingSource ??
    (await createSource({
      investigationId: investigation.id,
      url: page.finalUrl,
      canonicalUrl: page.finalUrl,
      title: page.title,
      sourceType: "website",
      discoveryMethod: "direct",
      accessStatus,
    }));
  if (existingSource) {
    await updateSourceVisit(existingSource.id, {
      accessStatus,
      title: page.title,
      url: page.finalUrl,
      canonicalUrl: page.finalUrl,
    });
  }
  await createObservation({
    investigationId: investigation.id,
    sourceId: source.id,
    pageTitle: page.title,
    extractedContent: page.text,
    httpStatus: page.httpStatus,
    observedAt: new Date(),
  });
  return investigation.id;
}
