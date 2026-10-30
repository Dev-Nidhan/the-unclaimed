import { connection } from "next/server";
import { checkHostedOllamaHealth } from "@/lib/ai/ollama";
import { checkDatabaseHealth } from "@/lib/db/queries";
import { reportOperationFailure } from "@/lib/sentry/report";

export async function GET() {
  await connection();

  try {
    await checkDatabaseHealth();
    if (process.env.RENDER === "true") {
      await checkHostedOllamaHealth();
    }
    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    reportOperationFailure("tiger-data", error);
    return Response.json({ ok: false }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
