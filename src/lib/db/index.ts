import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { redactDatabaseError } from "../redact";
import * as relations from "./relations";
import * as schema from "./schema";

export { redactDatabaseError };

const databaseSchema = { ...schema, ...relations };

type Database = PostgresJsDatabase<typeof databaseSchema>;
type SqlClient = ReturnType<typeof postgres>;

const globalForDatabase = globalThis as unknown as {
  __unclaimedSql?: SqlClient;
  __unclaimedDb?: Database;
};

function requireDatabaseUrl(): string {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set.");
  }
  return databaseUrl;
}

function clientOptions(databaseUrl: string): postgres.Options<Record<string, postgres.PostgresType>> {
  let url: URL;
  try {
    url = new URL(databaseUrl);
  } catch {
    throw new Error("DATABASE_URL is not a valid URL.");
  }

  const sslMode = url.searchParams.get("sslmode");
  const localHost = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (
    process.env.NODE_ENV === "production" &&
    (localHost || sslMode === "disable" || sslMode === "allow" || sslMode === "prefer")
  ) {
    throw new Error("Production DATABASE_URL must use a remote Tiger Data host and require TLS.");
  }
  if (!url.password && !localHost) {
    throw new Error("DATABASE_URL is missing a password.");
  }
  const ssl =
    sslMode === "disable" || localHost ? false : sslMode === "require" || sslMode === "prefer" || sslMode === "allow" || sslMode === "verify-full" ? sslMode : "require";

  return {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 15,
    prepare: url.port === "6432" ? false : true,
    ssl,
  };
}

export function getSql(): SqlClient {
  const existing = globalForDatabase.__unclaimedSql;
  if (existing) {
    return existing;
  }

  const databaseUrl = requireDatabaseUrl();
  const client = postgres(databaseUrl, clientOptions(databaseUrl));
  globalForDatabase.__unclaimedSql = client;
  return client;
}

export function getDb(): Database {
  const existing = globalForDatabase.__unclaimedDb;
  if (existing) {
    return existing;
  }

  const database = drizzle(getSql(), { schema: databaseSchema });
  globalForDatabase.__unclaimedDb = database;
  return database;
}

export async function closeDatabase(): Promise<void> {
  const client = globalForDatabase.__unclaimedSql;
  globalForDatabase.__unclaimedSql = undefined;
  globalForDatabase.__unclaimedDb = undefined;
  if (client) {
    await client.end({ timeout: 5 });
  }
}
