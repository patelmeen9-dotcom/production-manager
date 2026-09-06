import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";
import { PrismaClient } from "@prisma/client";
import ws from "ws";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

neonConfig.webSocketConstructor = ws;

function isNeonHost(url: string): boolean {
  try {
    const host = new URL(url.replace(/^postgres(ql)?:/, "http:")).hostname;
    return host.endsWith("neon.tech") || host.endsWith("neon.build");
  } catch {
    return url.includes("neon.tech") || url.includes("neon.build");
  }
}

function createPrismaClient(): PrismaClient {
  const log: Array<"error" | "warn"> =
    process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"];
  const url = process.env.DATABASE_URL;

  if (url && isNeonHost(url)) {
    const adapter = new PrismaNeon({ connectionString: url, max: 1 });
    return new PrismaClient({ adapter, log });
  }

  return new PrismaClient({ log });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();
globalForPrisma.prisma = prisma;
