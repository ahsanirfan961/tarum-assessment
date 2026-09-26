import "server-only";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

export const DEFAULT_DATABASE_URL = "postgres://fomi:fomi@localhost:5432/fomi";

/**
 * One pooled client for the process. Dev hot reloads re-evaluate this module,
 * so the pool is parked on `globalThis` rather than opened again each time.
 */
const globalForDb = globalThis;

globalForDb.fomiPool ??= new Pool({
  connectionString: process.env.DATABASE_URL || DEFAULT_DATABASE_URL,
  max: 10,
});

export const db = drizzle(globalForDb.fomiPool, { schema });

export class DatabaseError extends Error {
  constructor(message, status = 503) {
    super(message);
    this.name = "DatabaseError";
    this.status = status;
  }
}

/** True when Postgres simply isn't there, as opposed to a query failing. */
export function isConnectionError(err) {
  const code = err?.code ?? err?.cause?.code;
  return ["ECONNREFUSED", "ECONNRESET", "ENOTFOUND", "EHOSTUNREACH", "ETIMEDOUT", "57P03"].includes(
    code
  );
}

/** Turns a connection failure into something that says what to run. */
export function unreachable(err) {
  return new DatabaseError(
    "The database isn't reachable. Start it with `docker compose up -d`, then run `npm run db:migrate && npm run db:seed`.\n(" +
      (err?.cause?.message ?? err?.message) +
      ")"
  );
}
