import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function getDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) return undefined;

  try {
    const url = new URL(databaseUrl);
    const isSupabasePooler = url.hostname.endsWith(".pooler.supabase.com") || url.hostname === "pooler.supabase.com";
    const isSupabaseTransactionPooler = isSupabasePooler && url.port === "6543";

    // Transaction mode (6543) breaks Prisma's prepared statements ("s0 already exists")
    // without pgbouncer=true, but that flag costs ~5 round-trips per query.
    // Prefer the session pooler (5432) in DATABASE_URL: native prepared statements, 1 RTT.
    if (isSupabaseTransactionPooler && !url.searchParams.has("pgbouncer")) {
      url.searchParams.set("pgbouncer", "true");
    }

    if (isSupabasePooler && !url.searchParams.has("connection_limit")) {
      url.searchParams.set("connection_limit", "5");
    }

    return url.toString();
  } catch {
    return databaseUrl;
  }
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: { db: { url: getDatabaseUrl() } },
    transactionOptions: {
      maxWait: 10_000,
      timeout: 15_000
    },
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"]
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
