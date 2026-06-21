import { NextResponse } from "next/server";
import { resetExpireSweepThrottle } from "@/lib/games";
import { seed } from "@/prisma/seed";

/**
 * DESTRUCTIVE: seed() wipes ALL data (users, games, tournaments, clubs …) and
 * reseeds fixtures. To make it impossible to ever run against a real database,
 * the reset is refused unless the running DATABASE_URL is byte-for-byte equal to
 * an explicitly designated TEST_DATABASE_URL. Production never sets the latter,
 * and a dev machine pointed at the prod DB won't match it either.
 */
export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production" && process.env.ENABLE_TEST_RESET !== "true") {
    return NextResponse.json({ error: "Disabled" }, { status: 403 });
  }

  const dbUrl = process.env.DATABASE_URL ?? "";
  const testDbUrl = process.env.TEST_DATABASE_URL ?? "";
  if (!testDbUrl || testDbUrl !== dbUrl) {
    return NextResponse.json(
      { error: "Refusing to reset: DATABASE_URL is not the designated TEST_DATABASE_URL. Point the app at a dedicated test database and set TEST_DATABASE_URL to the same value." },
      { status: 403 }
    );
  }

  const token = request.headers.get("x-test-token");
  if (!process.env.TEST_RESET_TOKEN || token !== process.env.TEST_RESET_TOKEN) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await seed();
  resetExpireSweepThrottle();

  return NextResponse.json({ ok: true });
}
