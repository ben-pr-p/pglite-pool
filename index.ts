import { createServer, LogLevel } from "pglite-server";
import { PGlite } from "@electric-sql/pglite";
import { Pool } from "pg";
import type { Server } from "node:net";

type PgLitePoolOptions = {
  port?: number;
  logLevel?: LogLevel;
};

type Pg = {
  pool: Pool;
  connectionString: string;
  port: number;
  teardown: () => Promise<void>;
};

/**
 * Starts the server, incrementing the port each time if the port is already taken
 * Tries @param tries times
 * Returns the port that was successfully started
 * @param lite
 * @param port
 * @param tries
 */
const startServerAfterTries = (
  server: Server,
  tries: number = 5
): Promise<number> => {
  return new Promise((resolve, reject) => {
    const tryStart = (tries: number) => {
      if (tries === 0) {
        reject(new Error("Could not start server"));
        return;
      }

      server.on("error", (error: any) => {
        console.log("Error handling going");
        if (error.code === "EADDRINUSE") {
          tryStart(tries - 1);
        }
      });

      server.listen(0, () => {
        const address = server.address();

        if (!address || typeof address === "string") {
          throw new Error("Could not start server");
        }

        resolve(address.port);
      });
    };

    tryStart(tries);
  });
};

export async function getPostgres(
  options: PgLitePoolOptions = {}
): Promise<Pg> {
  const lite = new PGlite();
  await lite.waitReady;

  const pgServer = createServer(lite, {
    logLevel: options.logLevel || LogLevel.Error,
  });

  // Await listening
  const port = await startServerAfterTries(pgServer);

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
    port,
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
