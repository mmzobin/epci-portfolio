"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  addTournamentParticipant,
  clearTournamentPair,
  completeAmericanoTournament,
  completeFixedPairsTournament,
  completeTournament,
  createTournament,
  deleteTournament,
  generateAmericanoSchedule,
  generateFixedPairsSchedule,
  removeTournamentParticipant,
  setAmericanoMatchScore,
  setTournamentPair,
  updateTournament,
  updateTournamentResult
} from "@/lib/tournaments";

const tournamentSchema = z.object({
  title: z.string().min(3),
  startsAt: z.string().optional(),
  city: z.string().optional(),
  club: z.string().optional()
});

const tournamentUpdateSchema = tournamentSchema.extend({
  tournamentId: z.string().min(1)
});

const participantSchema = z.object({
  tournamentId: z.string().min(1),
  userId: z.string().min(1)
});

const resultRowSchema = z.object({
  matchesPlayed: z.coerce.number().int().min(0),
  wins: z.coerce.number().int().min(0)
}).refine((input) => input.wins <= input.matchesPlayed, {
  message: "Wins cannot be greater than matches played",
  path: ["wins"]
});

export async function createTournamentAction(formData: FormData) {
  const admin = await requireAdmin();
  const result = tournamentSchema.safeParse(normalizeForm(Object.fromEntries(formData)));
  if (!result.success) redirect("/admin/tournaments?error=tournament");

  const format = String(formData.get("format") ?? "MINI");
  const courts = Math.max(1, Number(formData.get("courts") ?? 1) || 1);
  const pointsPerMatch = Math.max(1, Number(formData.get("pointsPerMatch") ?? 24) || 24);

  const tournament = await createTournament({
    ...result.data,
    startsAt: parseOptionalDate(result.data.startsAt),
    createdById: admin.id,
    format,
    courts,
    pointsPerMatch
  });

  revalidatePath("/admin/tournaments");
  revalidatePath("/tournaments");
  redirect(`/admin/tournaments/${tournament.id}`);
}

export async function generateAmericanoScheduleAction(formData: FormData) {
  const admin = await requireAdmin();
  const tournamentId = z.string().min(1).parse(formData.get("tournamentId"));
  try {
    await generateAmericanoSchedule(tournamentId, admin);
  } catch (error) {
    redirect(`/admin/tournaments/${tournamentId}?error=${encodeURIComponent(errorMessage(error))}`);
  }
  revalidateTournament(tournamentId);
  redirect(`/admin/tournaments/${tournamentId}?saved=schedule`);
}

export async function regenerateAmericanoScheduleAction(formData: FormData) {
  const admin = await requireAdmin();
  const tournamentId = z.string().min(1).parse(formData.get("tournamentId"));
  try {
    await generateAmericanoSchedule(tournamentId, admin, { shuffle: true });
  } catch (error) {
    redirect(`/admin/tournaments/${tournamentId}?error=${encodeURIComponent(errorMessage(error))}`);
  }
  revalidateTournament(tournamentId);
  redirect(`/admin/tournaments/${tournamentId}?saved=schedule`);
}

export async function setAmericanoScoreAction(formData: FormData) {
  const admin = await requireAdmin();
  const tournamentId = z.string().min(1).parse(formData.get("tournamentId"));
  const matchId = z.string().min(1).parse(formData.get("matchId"));
  const winner = String(formData.get("winner"));
  if (winner !== "1" && winner !== "2") {
    redirect(`/admin/tournaments/${tournamentId}?error=${encodeURIComponent("Выберите победителя")}`);
  }
  try {
    // Win/loss model: winning team gets 1, losing team 0 (standings = wins).
    await setAmericanoMatchScore(matchId, winner === "1" ? 1 : 0, winner === "2" ? 1 : 0, admin);
  } catch (error) {
    redirect(`/admin/tournaments/${tournamentId}?error=${encodeURIComponent(errorMessage(error))}`);
  }
  revalidateTournament(tournamentId);
  redirect(`/admin/tournaments/${tournamentId}?saved=results`);
}

export async function completeAmericanoAction(formData: FormData) {
  const admin = await requireAdmin();
  const tournamentId = z.string().min(1).parse(formData.get("tournamentId"));
  try {
    await completeAmericanoTournament(tournamentId, admin);
  } catch (error) {
    redirect(`/admin/tournaments/${tournamentId}?error=${encodeURIComponent(errorMessage(error))}`);
  }
  revalidateTournament(tournamentId);
  revalidatePath("/ranking");
  revalidatePath("/profile");
  redirect(`/admin/tournaments/${tournamentId}?saved=completed`);
}

export async function setTournamentPairAction(formData: FormData) {
  const admin = await requireAdmin();
  const tournamentId = z.string().min(1).parse(formData.get("tournamentId"));
  const user1Id = z.string().min(1).parse(formData.get("user1Id"));
  const user2Id = z.string().min(1).parse(formData.get("user2Id"));
  try {
    await setTournamentPair(tournamentId, user1Id, user2Id, admin);
  } catch (error) {
    redirect(`/admin/tournaments/${tournamentId}?error=${encodeURIComponent(errorMessage(error))}`);
  }
  revalidateTournament(tournamentId);
  redirect(`/admin/tournaments/${tournamentId}?saved=participant`);
}

export async function clearTournamentPairAction(formData: FormData) {
  const admin = await requireAdmin();
  const tournamentId = z.string().min(1).parse(formData.get("tournamentId"));
  const userId = z.string().min(1).parse(formData.get("userId"));
  try {
    await clearTournamentPair(tournamentId, userId, admin);
  } catch (error) {
    redirect(`/admin/tournaments/${tournamentId}?error=${encodeURIComponent(errorMessage(error))}`);
  }
  revalidateTournament(tournamentId);
  redirect(`/admin/tournaments/${tournamentId}?saved=participant`);
}

export async function generateFixedPairsScheduleAction(formData: FormData) {
  const admin = await requireAdmin();
  const tournamentId = z.string().min(1).parse(formData.get("tournamentId"));
  try {
    await generateFixedPairsSchedule(tournamentId, admin);
  } catch (error) {
    redirect(`/admin/tournaments/${tournamentId}?error=${encodeURIComponent(errorMessage(error))}`);
  }
  revalidateTournament(tournamentId);
  redirect(`/admin/tournaments/${tournamentId}?saved=schedule`);
}

export async function regenerateFixedPairsScheduleAction(formData: FormData) {
  const admin = await requireAdmin();
  const tournamentId = z.string().min(1).parse(formData.get("tournamentId"));
  try {
    await generateFixedPairsSchedule(tournamentId, admin, { shuffle: true });
  } catch (error) {
    redirect(`/admin/tournaments/${tournamentId}?error=${encodeURIComponent(errorMessage(error))}`);
  }
  revalidateTournament(tournamentId);
  redirect(`/admin/tournaments/${tournamentId}?saved=schedule`);
}

export async function completeFixedPairsAction(formData: FormData) {
  const admin = await requireAdmin();
  const tournamentId = z.string().min(1).parse(formData.get("tournamentId"));
  try {
    await completeFixedPairsTournament(tournamentId, admin);
  } catch (error) {
    redirect(`/admin/tournaments/${tournamentId}?error=${encodeURIComponent(errorMessage(error))}`);
  }
  revalidateTournament(tournamentId);
  revalidatePath("/ranking");
  revalidatePath("/profile");
  redirect(`/admin/tournaments/${tournamentId}?saved=completed`);
}

export async function updateTournamentAction(formData: FormData) {
  const admin = await requireAdmin();
  const result = tournamentUpdateSchema.safeParse(normalizeForm(Object.fromEntries(formData)));
  if (!result.success) redirect("/admin/tournaments?error=tournament");

  const { tournamentId, ...input } = result.data;
  try {
    await updateTournament(tournamentId, { ...input, startsAt: parseOptionalDate(input.startsAt) }, admin);
  } catch (error) {
    redirect(`/admin/tournaments/${tournamentId}?error=${encodeURIComponent(errorMessage(error))}`);
  }

  revalidatePath("/admin/tournaments");
  revalidatePath(`/admin/tournaments/${tournamentId}`);
  revalidatePath("/tournaments");
  redirect(`/admin/tournaments/${tournamentId}?saved=1`);
}

export async function deleteTournamentAction(formData: FormData) {
  const admin = await requireAdmin();
  const tournamentId = z.string().min(1).parse(formData.get("tournamentId"));

  try {
    await deleteTournament(tournamentId, admin);
  } catch (error) {
    redirect(`/admin/tournaments/${tournamentId}?error=${encodeURIComponent(errorMessage(error))}`);
  }

  revalidatePath("/admin/tournaments");
  revalidatePath("/tournaments");
  revalidatePath("/ranking");
  revalidatePath("/profile");
  redirect("/admin/tournaments?deleted=1");
}

export async function addTournamentParticipantsAction(formData: FormData) {
  await requireAdmin();
  const tournamentId = z.string().min(1).parse(formData.get("tournamentId"));
  const userIds = Array.from(new Set(formData.getAll("userIds").map(String).filter(Boolean)));
  if (!userIds.length) redirect(`/admin/tournaments/${tournamentId}?error=${encodeURIComponent("Select at least one player.")}`);

  const failures: string[] = [];
  let added = 0;
  for (const userId of userIds) {
    try {
      await addTournamentParticipant(tournamentId, userId);
      added += 1;
    } catch (error) {
      failures.push(`${await playerLabel(userId)}: ${errorMessage(error)}`);
    }
  }

  revalidateTournament(tournamentId);
  if (failures.length) {
    const summary = `Added ${added} of ${userIds.length} players. ${failures.join("; ")}`;
    redirect(`/admin/tournaments/${tournamentId}?error=${encodeURIComponent(summary)}`);
  }
  redirect(`/admin/tournaments/${tournamentId}?saved=participant`);
}

export async function removeTournamentParticipantAction(formData: FormData) {
  const admin = await requireAdmin();
  const input = participantSchema.parse(Object.fromEntries(formData));

  try {
    await removeTournamentParticipant(input.tournamentId, input.userId, admin);
  } catch (error) {
    redirect(`/admin/tournaments/${input.tournamentId}?error=${encodeURIComponent(errorMessage(error))}`);
  }

  revalidateTournament(input.tournamentId);
  redirect(`/admin/tournaments/${input.tournamentId}?saved=participant`);
}

export async function updateTournamentResultsAction(formData: FormData) {
  const admin = await requireAdmin();
  const tournamentId = z.string().min(1).parse(formData.get("tournamentId"));

  const rows: { participationId: string; matchesPlayed: number; wins: number }[] = [];
  for (const [key, value] of formData.entries()) {
    const match = /^matches-(.+)$/.exec(key);
    if (!match) continue;
    const participationId = match[1];
    const parsed = resultRowSchema.safeParse({ matchesPlayed: value, wins: formData.get(`wins-${participationId}`) });
    if (!parsed.success) redirect(`/admin/tournaments/${tournamentId}?error=${encodeURIComponent("Check matches and wins.")}`);
    rows.push({ participationId, ...parsed.data });
  }
  if (!rows.length) redirect(`/admin/tournaments/${tournamentId}?error=${encodeURIComponent("No results to save.")}`);

  try {
    for (const row of rows) {
      await updateTournamentResult(row.participationId, { matchesPlayed: row.matchesPlayed, wins: row.wins }, admin);
    }
  } catch (error) {
    redirect(`/admin/tournaments/${tournamentId}?error=${encodeURIComponent(errorMessage(error))}`);
  }

  revalidateTournament(tournamentId);
  redirect(`/admin/tournaments/${tournamentId}?saved=results`);
}

export async function completeTournamentAction(formData: FormData) {
  const admin = await requireAdmin();
  const tournamentId = z.string().min(1).parse(formData.get("tournamentId"));

  try {
    await completeTournament(tournamentId, admin);
  } catch (error) {
    redirect(`/admin/tournaments/${tournamentId}?error=${encodeURIComponent(errorMessage(error))}`);
  }

  revalidateTournament(tournamentId);
  revalidatePath("/ranking");
  revalidatePath("/profile");
  redirect(`/admin/tournaments/${tournamentId}?saved=completed`);
}

function normalizeForm(input: Record<string, FormDataEntryValue>) {
  return Object.fromEntries(
    Object.entries(input).map(([key, value]) => {
      if (typeof value !== "string") return [key, value];
      const trimmed = value.trim();
      return [key, trimmed === "" ? undefined : trimmed];
    })
  );
}

function parseOptionalDate(value?: string) {
  return value ? new Date(value) : undefined;
}

function revalidateTournament(tournamentId: string) {
  revalidatePath("/admin/tournaments");
  revalidatePath(`/admin/tournaments/${tournamentId}`);
  revalidatePath("/tournaments");
  revalidatePath("/ranking");
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Could not complete the action.";
}

async function playerLabel(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true, lastName: true } });
  return user ? `${user.name} ${user.lastName ?? ""}`.trim() : "Player";
}
