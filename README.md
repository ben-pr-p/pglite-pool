# pglite-pool

Simplifies using `[pglite](https://github.com/electric-sql/pglite)` in Node/Bun for
codegen and tests by using `[pglite-server](https://www.npmjs.com/package/pglite-server)`
to create a Postgres server at a random port.

## Usage

Both a teardown style and a callback style are supported.

### Teardown style
```typescript
import { getPostgres } from 'pglite-pool';

async function main() {
	const pg = await getPostgres()

	// pg.pool is an already connected Postgres pool
	const pool = pg.pool

	// Do pool things...
	await pool.query('select 1')

	const client = await pool.connect()
	await client.query('select 1')
	client.release()

	// Teardowns the pool, server, and in-memory Postgres instance
	await pg.teardown()
}
```

### Callback Style
```typescript
import { withPostgres } from 'pglite-pool';

async function main() {
	const anythingString = await withPostgres(async (pg) => {
		const pool = pg.pool
		await pool.query('select 1')
		return 'anything';
		// Teardown happens automatically after return
	})
}
```

### With Connection String

In both the callback and teardown styles, the `pg` objection has a `connectionString`
property. 

This is useful for plugging into libraries such as [kanel](https://github.com/kristiandupont/kanel)
or [graphile-migrate](https://github.com/graphile/migrate) which construct their own Pool 
object internally.

For example, to run Kanel codegen without Docker or external setup, do:
```typescript
// codegen.ts
import { processDatabase } from "kanel";
import { makeKyselyHook } from "kanel-kysely";
import { withPostgres } from 'pglite-pool'

const makeConfig = (connectionString: string) => {
  schemas: ["my_schema"],
  outputPath: "./src/database",
  preRenderHooks: [makeKyselyHook()],
  connection: {
    connectionString,
  },
};

async function run() {
	await withPostgres(async (pg) => {
		await processDatabase(makeConfig(pg.connectionString));
	})
}

run();
```

And then `bun run codegen.ts` just works™.
