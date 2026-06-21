import { NextResponse } from "next/server";
import { captureRankingSnapshot } from "@/lib/ranking";

export const dynamic = "force-dynamic";

/**
 * GET /api/cron/snapshot
 * Records the weekly ranking snapshot (best rank + weekly +/- movement).
 * Triggered by the Vercel weekly cron (see vercel.json). Vercel automatically
 * attaches `Authorization: Bearer ${CRON_SECRET}` when CRON_SECRET is set.
 * Can also be triggered manually with ?secret=CRON_SECRET.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const url = new URL(request.url);
    const provided = request.headers.get("authorization")?.replace("Bearer ", "") || url.searchParams.get("secret");
    if (provided !== secret) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  try {
    const result = await captureRankingSnapshot();
    return NextResponse.json({ ok: true, ...result, takenAt: new Date().toISOString() });
  } catch (error) {
    console.error("ranking snapshot failed", error);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
