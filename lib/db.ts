import pg from "pg";

const { Client } = pg;

type QueryClient = pg.Client;
type QueryParams = readonly unknown[];

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

function createClient() {
  const connectionString = getConnectionString();

  return new Client({
    connectionString,
    ssl: shouldUseSsl(connectionString) ? { rejectUnauthorized: false } : undefined
  });
}

export async function query<T = Record<string, unknown>>(
  text: string,
  params: QueryParams = []
) {
  const client = createClient();

  await client.connect();

  try {
    const result = await client.query<T>(text, [...params]);
    return result.rows;
  } finally {
    await client.end();
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
  const client = createClient();

  await client.connect();

  try {
    return await client.query(text, [...params]);
  } finally {
    await client.end();
  }
}

export async function withTransaction<T>(
  callback: (client: QueryClient) => Promise<T>
) {
  const client = createClient();

  await client.connect();

  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    await client.end();
  }
}
