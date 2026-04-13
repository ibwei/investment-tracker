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

function isTransientConnectionError(error: unknown) {
  const code = (error as { code?: string })?.code;
  const message = String((error as { message?: string })?.message ?? "");

  return (
    code === "ECONNRESET" ||
    code === "ECONNREFUSED" ||
    code === "ETIMEDOUT" ||
    message.includes("Connection terminated unexpectedly") ||
    message.includes("Client has encountered a connection error")
  );
}

export async function query<T = Record<string, unknown>>(
  text: string,
  params: QueryParams = []
) {
  try {
    const result = await getPool().query<T>(text, [...params]);
    return result.rows;
  } catch (error) {
    if (!isTransientConnectionError(error)) {
      throw error;
    }

    const result = await getPool().query<T>(text, [...params]);
    return result.rows;
  }
}

export async function queryOne<T = Record<string, unknown>>(
  text: string,
  params: QueryParams = []
) {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

export async function execute(text: string, params: QueryParams = []) {
  try {
    return await getPool().query(text, [...params]);
  } catch (error) {
    if (!isTransientConnectionError(error)) {
      throw error;
    }

    return await getPool().query(text, [...params]);
  }
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
