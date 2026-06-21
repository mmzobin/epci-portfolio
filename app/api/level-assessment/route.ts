import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { canRetakeAssessment } from "@/lib/level-assessment";
import { prisma } from "@/lib/prisma";

const payloadSchema = z.object({
  score: z.coerce.number().int().min(0),
  level: z.coerce.number().min(1).max(7)
});

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Требуется вход в систему." }, { status: 401 });
  }

  if (!canRetakeAssessment(user.levelAssessmentDate)) {
    return NextResponse.json(
      { error: "Опрос можно проходить повторно не чаще одного раза в 30 дней." },
      { status: 429 }
    );
  }

  const parsed = payloadSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Некорректный результат опроса." }, { status: 400 });
  }

  // Only seed the rating from the survey before any ranked play (see actions.ts).
  const noRankedYet = ((user as { ratedGames?: number }).ratedGames ?? 0) === 0;

  await (prisma.user as unknown as { update: (args: unknown) => Promise<unknown> }).update({
    where: { id: user.id },
    data: {
      level: parsed.data.level,
      levelAssessmentScore: parsed.data.score,
      levelAssessmentDate: new Date(),
      ...(noRankedYet ? { skillRating: parsed.data.level } : {})
    }
  });

  revalidatePath("/");
  revalidatePath("/profile");
  revalidatePath("/level-assessment");

  return NextResponse.json({ ok: true });
}
