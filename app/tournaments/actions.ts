"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { addTournamentParticipant, joinFixedPairsTournament, TournamentFormat } from "@/lib/tournaments";

export async function joinTournamentAction(formData: FormData) {
  const user = await requireUser();
  const tournamentId = z.string().min(1).parse(formData.get("tournamentId"));
  const partnerId = (formData.get("partnerId") ? String(formData.get("partnerId")) : "") || null;

  try {
    const tournament = await prisma.tournament.findUnique({ where: { id: tournamentId }, select: { format: true } });
    if ((tournament as { format?: string } | null)?.format === TournamentFormat.FIXED_PAIRS) {
      await joinFixedPairsTournament(tournamentId, user.id, partnerId);
    } else {
      await addTournamentParticipant(tournamentId, user.id);
    }
  } catch (error) {
    redirect(`/tournaments?error=${encodeURIComponent(errorMessage(error))}`);
  }

  revalidatePath("/tournaments");
  revalidatePath(`/admin/tournaments/${tournamentId}`);
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Could not register for the tournament.";
}
