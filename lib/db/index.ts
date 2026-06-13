// Drizzle DB client (postgres.js driver), singleton across Next hot-reloads.
// DATABASE_URL: on Railway = the private-network Postgres URL (set as a reference var);
// locally = the public TCP-proxy URL pulled into a gitignored .env. No sslmode ceremony —
// Railway Postgres handles TLS over its proxy/private network transparently.

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error(
    "DATABASE_URL is not set. Locally: pull it from Railway into .env. On Railway: set DATABASE_URL=${{Postgres.DATABASE_URL}} on the app service.",
  );
}

// Reuse one postgres.js connection pool across hot-reloads in dev so we don't leak
// connections. In production a fresh module load gets a fresh pool, which is fine.
const globalForDb = globalThis as unknown as {
  __pohSql?: ReturnType<typeof postgres>;
};

const sql =
  globalForDb.__pohSql ??
  postgres(connectionString, {
    max: 10,
    // Keep idle connections short-lived; Railway proxy drops long-idle sockets.
    idle_timeout: 20,
    max_lifetime: 60 * 30,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__pohSql = sql;
}

export const db = drizzle(sql, { schema });
export { sql };
export * from "./schema";
