import { createServer } from "pglite-server";
import { PGlite } from "@electric-sql/pglite";
import { Pool } from "pg";

const STARTING_PORT = 6432;

type PgLitePoolOptions = {
  port?: number;
};

let nextPort = STARTING_PORT;

type Pg = {
  pool: Pool;
  connectionString: string;
  teardown: () => Promise<void>;
};

export async function getPostgres(
  options: PgLitePoolOptions = {}
): Promise<Pg> {
  const port = options?.port ?? nextPort++;

  const lite = new PGlite();
  await lite.waitReady;

  const pgServer = createServer(lite);

  // Await listening
  await new Promise<void>((resolve, _reject) => {
    pgServer.listen(port, () => {
      resolve();
    });
  });

  const connectionString = `postgresql://postgres:postgres@localhost:${port}/postgres`;

  const pool = new Pool({
    connectionString,
  });

  const teardown = async () => {
    await pool.end();
    await new Promise<void>((resolve, reject) => {
      pgServer.close((err: Error | undefined) => {
        if (err) reject(err);
        resolve();
      });
    });
    await lite.close();
  };

  return {
    pool,
    connectionString,
    teardown,
  };
}

export function withPostgres<T>(fn: (pg: Pg) => Promise<void>): Promise<T>;
export function withPostgres<T>(
  options: PgLitePoolOptions,
  fn: (pg: Pg) => Promise<void>
): Promise<T>;
export async function withPostgres(
  param1: PgLitePoolOptions | ((pg: Pg) => Promise<void>),
  param2?: (pg: Pg) => Promise<void>
) {
  const options = typeof param1 === "object" ? param1 : undefined;

  const fn = typeof param1 === "function" ? param1 : param2;

  if (!fn) {
    throw new Error("fn is required");
  }

  const pg = await getPostgres(options);

  try {
    return await fn(pg);
  } finally {
    await pg.teardown();
  }
}
