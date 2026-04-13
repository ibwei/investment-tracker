import pg from "pg";
import { getCloudflareContext } from "@opennextjs/cloudflare";

const { Client } = pg;

type QueryClient = pg.Client;
type QueryParams = readonly unknown[];

type HyperdriveBinding = {
  connectionString?: string;
};

const LOCAL_HYPERDRIVE_PLACEHOLDER = "postgres://user:password@localhost:5432/postgres";

type DatabaseConnectionConfig = {
  connectionString: string;
  ssl?: { rejectUnauthorized: false };
};

function getHyperdriveConnectionString() {
  try {
    const { env } = getCloudflareContext();
    const connectionString =
      (env as { HYPERDRIVE?: HyperdriveBinding }).HYPERDRIVE?.connectionString || "";
    return connectionString === LOCAL_HYPERDRIVE_PLACEHOLDER ? "" : connectionString;
  } catch {
    return "";
  }
}

function getConnectionConfig(): DatabaseConnectionConfig {
  const hyperdriveConnectionString = getHyperdriveConnectionString();
  if (hyperdriveConnectionString) {
    return {
      connectionString: hyperdriveConnectionString
    };
  }

  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("HYPERDRIVE binding or DATABASE_URL is required before accessing the database.");
  }

  return {
    connectionString,
    ssl: shouldUseSsl(connectionString) ? { rejectUnauthorized: false } : undefined
  };
}

function shouldUseSsl(connectionString: string) {
  const url = new URL(connectionString);

  if (url.searchParams.get("sslmode") === "disable") {
    return false;
  }

  return !["localhost", "127.0.0.1", "::1"].includes(url.hostname);
}

function createClient() {
  const connectionConfig = getConnectionConfig();

  return new Client({
    connectionString: connectionConfig.connectionString,
    connectionTimeoutMillis: 5_000,
    ssl: connectionConfig.ssl
  });
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
  const client = createClient();

  try {
    await client.connect();
    const result = await client.query<T>(text, [...params]);
    return result.rows;
  } catch (error) {
    if (!isTransientConnectionError(error)) {
      throw error;
    }

    const retryClient = createClient();
    try {
      await retryClient.connect();
      const result = await retryClient.query<T>(text, [...params]);
      return result.rows;
    } finally {
      await retryClient.end().catch(() => undefined);
    }
  } finally {
    await client.end().catch(() => undefined);
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

  try {
    await client.connect();
    return await client.query(text, [...params]);
  } catch (error) {
    if (!isTransientConnectionError(error)) {
      throw error;
    }

    const retryClient = createClient();
    try {
      await retryClient.connect();
      return await retryClient.query(text, [...params]);
    } finally {
      await retryClient.end().catch(() => undefined);
    }
  } finally {
    await client.end().catch(() => undefined);
  }
}

export async function withTransaction<T>(
  callback: (client: QueryClient) => Promise<T>
) {
  const client = createClient();

  try {
    await client.connect();
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    await client.end().catch(() => undefined);
  }
}
