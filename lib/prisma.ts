import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis;

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    return new PrismaClient();
  }

  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

export const prisma =
  globalForPrisma.__cefidefiPrisma ??
  createPrismaClient();

if (!globalForPrisma.__cefidefiPrisma) {
  globalForPrisma.__cefidefiPrisma = prisma;
}
