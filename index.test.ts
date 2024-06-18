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

  describe("isolation", () => {
    it("each created postgres is isolated", async () => {
      const pg1 = await getPostgres();
      const pg2 = await getPostgres();

      // Test that these two are not talking to each other, but each is persistent
      await pg1.pool.query("CREATE TABLE test (id SERIAL PRIMARY KEY)");
      await pg2.pool.query("CREATE TABLE test (id SERIAL PRIMARY KEY)");

      const result1 = await pg1.pool.query("SELECT * FROM test");
      const result2 = await pg2.pool.query("SELECT * FROM test");

      // Insert 1 row into 1, and 2 rows into 2
      await pg1.pool.query("INSERT INTO test (id) VALUES (1)");
      await pg2.pool.query("INSERT INTO test (id) VALUES (2)");
      await pg2.pool.query("INSERT INTO test (id) VALUES (3)");

      const result3 = await pg1.pool.query("SELECT * FROM test");
      const result4 = await pg2.pool.query("SELECT * FROM test");

      await pg1.teardown();
      await pg2.teardown();

      expect(result1.rowCount).toBe(0);
      expect(result2.rowCount).toBe(0);

      expect(result3.rowCount).toBe(1);
      expect(result4.rowCount).toBe(2);
    });
  });

  it("skips taken ports", async () => {
    // Take a port
    const pg1 = await getPostgres();
    // Take the new guys port
    await getPostgres({ port: pg1.port + 1 });
    // Would fail with naive implementation
    await getPostgres();
  });
});
