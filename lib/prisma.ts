import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis;

export const prisma =
  globalForPrisma.__cefidefiPrisma ??
  new PrismaClient();

if (!globalForPrisma.__cefidefiPrisma) {
  globalForPrisma.__cefidefiPrisma = prisma;
}
