import pg from "pg";

const { Pool } = pg;

type QueryClient = pg.PoolClient;
type QueryParams = readonly unknown[];
type GlobalWithPgPool = typeof globalThis & {
  __earnCompassPgPool?: pg.Pool;
  __earnCompassPgPoolConnectionString?: string;
};

function getConnectionString() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is required before accessing the database.");
  }

  return connectionString;
}

function shouldUseSsl(connectionString: string) {
  const url = new URL(connectionString);

  if (url.searchParams.get("sslmode") === "disable") {
    return false;
  }

  return !["localhost", "127.0.0.1", "::1"].includes(url.hostname);
}

function createPool() {
  const connectionString = getConnectionString();

  const pool = new Pool({
    connectionString,
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 30_000,
    max: 5,
    ssl: shouldUseSsl(connectionString) ? { rejectUnauthorized: false } : undefined
  });

  pool.on("error", (error) => {
    console.error("Unexpected idle PostgreSQL client error", error);
  });

  return pool;
}

function getPool() {
  const globalForPool = globalThis as GlobalWithPgPool;
  const connectionString = getConnectionString();

  if (
    !globalForPool.__earnCompassPgPool ||
    globalForPool.__earnCompassPgPoolConnectionString !== connectionString
  ) {
    globalForPool.__earnCompassPgPool = createPool();
    globalForPool.__earnCompassPgPoolConnectionString = connectionString;
  }

  return globalForPool.__earnCompassPgPool;
}

export async function query<T = Record<string, unknown>>(
  text: string,
  params: QueryParams = []
) {
  const result = await getPool().query<T>(text, [...params]);
  return result.rows;
}

export async function queryOne<T = Record<string, unknown>>(
  text: string,
  params: QueryParams = []
) {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

export async function execute(text: string, params: QueryParams = []) {
  return await getPool().query(text, [...params]);
}

export async function withTransaction<T>(
  callback: (client: QueryClient) => Promise<T>
) {
  const client = await getPool().connect();

  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
