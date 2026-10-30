import { connection } from "next/server";
import { checkDatabaseHealth } from "@/lib/db/queries";
import { reportOperationFailure } from "@/lib/sentry/report";

export async function GET() {
  await connection();

  try {
    const health = await checkDatabaseHealth();
    return Response.json(health, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    reportOperationFailure("tiger-data", error);
    return Response.json(
      { ok: false, database: "postgresql" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
