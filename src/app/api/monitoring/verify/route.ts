import { reportOperationFailure } from "@/lib/sentry/report";

export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return Response.json({ error: "Not available." }, { status: 404 });
  }
  const error = new Error("The Unclaimed Sentry verification");
  reportOperationFailure("verification", error);
  throw error;
}
