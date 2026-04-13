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

const MAX_DB_ATTEMPTS = 3;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createDatabaseUnavailableError(cause: unknown) {
  const error = new Error("Temporary database connection issue. Please try again.");
  (error as { status?: number; cause?: unknown }).status = 503;
  (error as { status?: number; cause?: unknown }).cause = cause;
  return error;
}

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

export function isTransientConnectionError(error: unknown) {
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

async function withDatabaseRetry<T>(operation: () => Promise<T>) {
  let lastError: unknown;

  for (let attempt = 0; attempt < MAX_DB_ATTEMPTS; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (!isTransientConnectionError(error) || attempt === MAX_DB_ATTEMPTS - 1) {
        break;
      }

      await sleep(100 * (attempt + 1));
    }
  }

  if (isTransientConnectionError(lastError)) {
    throw createDatabaseUnavailableError(lastError);
  }

  throw lastError;
}

export async function query<T = Record<string, unknown>>(
  text: string,
  params: QueryParams = []
) {
  return withDatabaseRetry(async () => {
    const client = createClient();

    try {
      await client.connect();
      const result = await client.query<T>(text, [...params]);
      return result.rows;
    } finally {
      await client.end().catch(() => undefined);
    }
  });
}

export async function queryOne<T = Record<string, unknown>>(
  text: string,
  params: QueryParams = []
) {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

export async function execute(text: string, params: QueryParams = []) {
  return withDatabaseRetry(async () => {
    const client = createClient();

    try {
      await client.connect();
      return await client.query(text, [...params]);
    } finally {
      await client.end().catch(() => undefined);
    }
  });
}

export async function withTransaction<T>(
  callback: (client: QueryClient) => Promise<T>,
  options: { retryTransient?: boolean } = {}
) {
  const maxAttempts = options.retryTransient ? MAX_DB_ATTEMPTS : 1;
  let lastError: unknown;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const client = createClient();
    let didBegin = false;

    try {
      await client.connect();
      await client.query("BEGIN");
      didBegin = true;
      const result = await callback(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      lastError = error;

      if (didBegin) {
        await client.query("ROLLBACK").catch(() => undefined);
      }

      if (isTransientConnectionError(error) && attempt < maxAttempts - 1) {
        await sleep(100 * (attempt + 1));
        continue;
      }

      if (isTransientConnectionError(error)) {
        throw createDatabaseUnavailableError(error);
      }

      throw error;
    } finally {
      await client.end().catch(() => undefined);
    }
  }

  throw createDatabaseUnavailableError(lastError);
}
