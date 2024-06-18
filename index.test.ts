import { describe, it, expect } from "bun:test";

import { getPostgres, withPostgres } from "./index";

describe("pglite-pool", () => {
  describe("getPostgres", () => {
    it("should create a pool with a connection string", async () => {
      const pg = await getPostgres();
      expect(pg.pool).toBeDefined();
      expect(pg.connectionString).toContain("postgresql://");
      await pg.teardown();
    });

    it("should allow queries to be run", async () => {
      const pg = await getPostgres();
      const result = await pg.pool.query("SELECT 1 AS value");
      expect(result.rows[0].value).toBe(1);
      await pg.teardown();
    });
  });

  describe("withPostgres", () => {
    it("should execute a function with pg instance and auto-teardown", async () => {
      const result = await withPostgres(async (pg) => {
        const queryResult = await pg.pool.query("SELECT 1 AS value");
        return queryResult.rows[0].value;
      });

      expect(result).toBe(1);
    });

    it("should handle errors without crashing", async () => {
      await expect(
        withPostgres(async (pg) => {
          throw new Error("Test error");
        })
      ).rejects.toThrow("Test error");
    });
  });
});
