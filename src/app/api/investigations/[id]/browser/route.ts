import { z } from "zod";
import {
  completeInvestigation,
  goBack,
  goForward,
  navigateBrowser,
  publicPageUrl,
  readBrowserView,
  redactBrowserError,
  reloadBrowser,
  startBrowserSession,
  stopBrowserSession,
} from "@/lib/browser/cloud";
import { getInvestigationById } from "@/lib/db/queries";
import { redactDatabaseError } from "@/lib/redact";
import { reportOperationFailure, traceOperation } from "@/lib/sentry/report";

const command = z.discriminatedUnion("action", [
  z.object({ action: z.literal("start") }),
  z.object({ action: z.literal("navigate"), url: z.string().trim().min(1) }),
  z.object({ action: z.literal("back") }),
  z.object({ action: z.literal("forward") }),
  z.object({ action: z.literal("reload") }),
  z.object({ action: z.literal("stop") }),
  z.object({ action: z.literal("complete") }),
  z.object({ action: z.literal("live") }),
]);

function publicError(error: unknown): string {
  return redactDatabaseError(new Error(redactBrowserError(error)));
}

async function investigationOrNull(id: string) {
  if (!z.uuid().safeParse(id).success) {
    return null;
  }
  return getInvestigationById(id);
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const investigation = await investigationOrNull(id);
  if (!investigation) {
    return Response.json({ error: "Investigation not found." }, { status: 404 });
  }
  try {
    return Response.json(await readBrowserView(investigation.id));
  } catch (error) {
    reportOperationFailure("browserbase", error, id);
    return Response.json({ error: publicError(error) }, { status: 502 });
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const investigation = await investigationOrNull(id);
  if (!investigation) {
    return Response.json({ error: "Investigation not found." }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "The browser command was not valid." }, { status: 400 });
  }
  const parsed = command.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "The browser command was not valid." }, { status: 400 });
  }

  try {
    const commandName = parsed.data.action;
    const run = () => {
      if (commandName === "start") {
        return startBrowserSession(investigation.id, investigation.startingUrl);
      }
      if (commandName === "navigate") {
        return navigateBrowser(investigation.id, publicPageUrl(parsed.data.url));
      }
      if (commandName === "back") {
        return goBack(investigation.id);
      }
      if (commandName === "forward") {
        return goForward(investigation.id);
      }
      if (commandName === "reload") {
        return reloadBrowser(investigation.id);
      }
      if (commandName === "stop") {
        return stopBrowserSession(investigation.id);
      }
      if (commandName === "complete") {
        return completeInvestigation(investigation.id);
      }
      return readBrowserView(investigation.id);
    };
    const view = await traceOperation(
      { name: `Browser ${commandName}`, operation: "browserbase", investigationId: investigation.id },
      run,
    );
    return Response.json(view);
  } catch (error) {
    reportOperationFailure("browserbase", error, id);
    const message = publicError(error);
    const status = message === "BROWSERBASE_API_KEY is not set." ? 503 : 502;
    return Response.json({ error: message }, { status });
  }
}
