import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as typeof globalThis & {
  __cefidefiPrisma?: PrismaClient;
};

function getConnectionString() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is required before accessing the database.");
  }

  return connectionString;
}

function createPrismaClient() {
  const adapter = new PrismaPg({ connectionString: getConnectionString() });
  return new PrismaClient({ adapter });
}

function getPrismaClient() {
  if (!globalForPrisma.__cefidefiPrisma) {
    globalForPrisma.__cefidefiPrisma = createPrismaClient();
  }

  return globalForPrisma.__cefidefiPrisma;
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, property) {
    const client = getPrismaClient();
    const value = Reflect.get(client, property);

    return typeof value === "function" ? value.bind(client) : value;
  }
});
