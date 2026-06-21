"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { canRetakeAssessment } from "@/lib/level-assessment";
import { prisma } from "@/lib/prisma";

export async function saveLevelAssessmentAction(formData: FormData) {
  const user = await requireUser();
  if (!canRetakeAssessment(user.levelAssessmentDate)) redirect("/level-assessment?error=too-soon");

  const score = z.coerce.number().int().min(0).parse(formData.get("score"));
  const level = z.coerce.number().min(1).max(7).parse(formData.get("level"));

  // Seed the dynamic rating from the survey ONLY before any ranked play — once
  // the player has rated games, their rating is earned and the survey must not
  // overwrite it (retaking only refreshes the level band).
  const noRankedYet = ((user as { ratedGames?: number }).ratedGames ?? 0) === 0;

  await (prisma.user as unknown as { update: (args: unknown) => Promise<unknown> }).update({
    where: { id: user.id },
    data: {
      level,
      levelAssessmentScore: score,
      levelAssessmentDate: new Date(),
      ...(noRankedYet ? { skillRating: level } : {})
    }
  });

  revalidatePath("/");
  revalidatePath("/profile");
  revalidatePath("/level-assessment");
  redirect("/profile");
}
