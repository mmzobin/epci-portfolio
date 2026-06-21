"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { AvatarUploadError, isAvatarFile, uploadUserAvatar } from "@/lib/avatar-storage";
import { clearSession, hashPassword, requireAdmin, requireOrganizer, requireUser, setSession, verifyPassword } from "@/lib/auth";
import { addGuest, addParticipantToGame, createGame, deleteGame, joinGame, leaveGame, removeGuest, setCourtBooked, updateGameStatus, updateParticipation } from "@/lib/games";
import { applyRating, confirmMatchResult, recomputeMatch, recomputeWithRounds, saveMatchRounds, setGameRanked, type RoundDraft } from "@/lib/ranked";
import { calculatePricePerPlayer } from "@/lib/pricing";
import { notifyNewGame } from "@/lib/telegram-bot";
import { prisma } from "@/lib/prisma";
import { type GameStatus as GameStatusType, ParticipationStatus, PaymentStatus } from "@/lib/statuses";

const registerSchema = z.object({
  name: z.string().min(2),
  lastName: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  phone: z.string().optional(),
  telegramUsername: z.string().optional(),
  city: z.string().optional()
});

const profileSchema = z.object({
  name: z.string().min(2),
  lastName: z.string().min(2),
  phone: z.string().optional(),
  telegramUsername: z.string().optional(),
  city: z.string().optional()
});

export async function registerAction(formData: FormData) {
  const result = registerSchema.safeParse(normalizeForm(Object.fromEntries(formData)));
  if (!result.success) {
    const hasInvalidEmail = result.error.issues.some((issue) => issue.path[0] === "email");
    redirect(`/register?error=${hasInvalidEmail ? "invalid-email" : "invalid"}`);
  }

  const input = result.data;
  const exists = await prisma.user.findUnique({ where: { email: input.email.toLowerCase() } });
  if (exists) redirect("/register?error=email");

  const { password, ...userInput } = input;
  const user = await prisma.user.create({
    data: {
      ...userInput,
      email: input.email.toLowerCase(),
      level: 1.0,
      passwordHash: await hashPassword(password)
    }
  });
  setSession(user.id);
  redirect("/level-assessment");
}

export async function updateProfileAction(formData: FormData) {
  const user = await requireUser();
  const result = profileSchema.safeParse(normalizeForm(Object.fromEntries(formData)));
  if (!result.success) redirect("/profile?error=profile");

  const avatarFile = formData.get("avatarFile");
  let avatarData: { photoUrl: string; avatarPath: string } | null = null;

  if (isAvatarFile(avatarFile)) {
    try {
      avatarData = await uploadUserAvatar(user.id, avatarFile, user.avatarPath);
    } catch (error) {
      if (error instanceof AvatarUploadError) redirect(`/profile?error=avatar-${error.code}`);
      throw error;
    }
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      ...result.data,
      ...(avatarData ?? {})
    }
  });

  revalidatePath("/profile");
  revalidatePath("/");
  revalidatePath("/ranking");
  revalidatePath("/admin/users");
  redirect("/profile?updated=1");
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

export async function loginAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").toLowerCase();
  const password = String(formData.get("password") ?? "");
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await verifyPassword(password, user.passwordHash))) redirect("/login?error=credentials");
  if (user.deactivatedAt) redirect("/login?error=deactivated");
  setSession(user.id);
  if (!user.levelAssessmentDate) redirect("/level-assessment");
  redirect("/");
}

export async function logoutAction() {
  clearSession();
  redirect("/");
}

export async function joinGameAction(formData: FormData) {
  const user = await requireUser();
  const gameId = String(formData.get("gameId"));
  const redirectTo = String(formData.get("redirectTo") ?? "");
  try {
    await joinGame(user.id, gameId);
  } catch (error) {
    redirect(`/games/${gameId}?error=${encodeURIComponent(errorMessage(error))}`);
  }
  revalidatePath("/");
  revalidatePath(`/games/${gameId}`);
  if (redirectTo === `/games/${gameId}`) redirect(`/games/${gameId}?joined=1`);
}

export async function leaveGameAction(formData: FormData) {
  const user = await requireUser();
  const gameId = String(formData.get("gameId"));
  const redirectTo = String(formData.get("redirectTo") ?? "");
  try {
    await leaveGame(user.id, gameId);
  } catch (error) {
    redirect(`/games/${gameId}?error=${encodeURIComponent(errorMessage(error))}`);
  }
  revalidatePath("/");
  revalidatePath(`/games/${gameId}`);
  if (redirectTo === `/games/${gameId}`) redirect(`/games/${gameId}?left=1`);
}

const gameSchema = z.object({
  title: z.string().min(3),
  startsAt: z.string().min(10),
  clubId: z.string().min(1),
  courtNumber: z.string().min(1),
  courtPricePerHour: z.preprocess(
    (value) => (value === "" || value == null ? undefined : Number(value)),
    z.number().positive().max(100000).optional()
  ),
  maxPlayers: z.preprocess((value) => Number(value), z.number().int().min(1).max(100)),
  minLevel: z.coerce.number().min(1).max(7),
  maxLevel: z.coerce.number().min(1).max(7)
}).refine((game) => game.minLevel <= game.maxLevel, {
  message: "Minimum level cannot be higher than maximum level",
  path: ["minLevel"]
});

export async function createGameAction(formData: FormData) {
  const organizer = await requireOrganizer();
  const result = gameSchema.safeParse(Object.fromEntries(formData));
  if (!result.success) redirect("/organizer/games/new?error=game");
  const input = result.data;
  const club = await getActiveClub(input.clubId);
  const courtPricePerHour = input.courtPricePerHour ?? club.hourlyCourtPrice;
  const pricePerPlayer = calculatePricePerPlayer(courtPricePerHour, input.maxPlayers);
  let game;
  try {
    game = await createGame({
      ...input,
      city: club.city,
      club: club.name,
      address: club.address,
      courtPricePerHour,
      pricePerPlayer,
      startsAt: new Date(input.startsAt),
      organizerId: organizer.id
    });
  } catch (error) {
    redirect(`/organizer/games/new?error=${encodeURIComponent(errorMessage(error))}`);
  }
  try {
    await notifyNewGame(game);
  } catch {
    // Notifications must never block game creation.
  }
  redirect(`/organizer/games/${game.id}?saved=created`);
}

export async function toggleCourtBookedAction(formData: FormData) {
  const user = await requireUser();
  const gameId = String(formData.get("gameId"));
  const booked = String(formData.get("booked")) === "true";
  try {
    await setCourtBooked(gameId, user, booked);
  } catch (error) {
    redirect(`/games/${gameId}?error=${encodeURIComponent(errorMessage(error))}`);
  }
  revalidatePath(`/games/${gameId}`);
  revalidatePath("/");
  redirect(`/games/${gameId}`);
}

function rankedRedirectTo(formData: FormData, gameId: string) {
  const to = String(formData.get("redirectTo") ?? "");
  return to === `/organizer/games/${gameId}` ? to : `/games/${gameId}`;
}

export async function setGameRankedAction(formData: FormData) {
  const user = await requireUser();
  const gameId = String(formData.get("gameId"));
  const ranked = String(formData.get("ranked")) === "true";
  const back = rankedRedirectTo(formData, gameId);
  try {
    await setGameRanked(gameId, ranked, user);
  } catch (error) {
    redirect(`${back}?error=${encodeURIComponent(errorMessage(error))}`);
  }
  revalidatePath(back);
  redirect(back);
}

export async function saveMatchRoundsAction(formData: FormData) {
  const user = await requireUser();
  const gameId = String(formData.get("gameId"));
  const back = rankedRedirectTo(formData, gameId);
  let rounds: RoundDraft[] = [];
  try {
    rounds = JSON.parse(String(formData.get("rounds") ?? "[]")) as RoundDraft[];
  } catch {
    rounds = [];
  }
  try {
    await saveMatchRounds(gameId, rounds, user);
  } catch (error) {
    redirect(`${back}?error=${encodeURIComponent(errorMessage(error))}`);
  }
  revalidatePath(back);
  redirect(`${back}?rated=saved`);
}

export async function confirmMatchResultAction(formData: FormData) {
  const user = await requireUser();
  const gameId = String(formData.get("gameId"));
  const back = rankedRedirectTo(formData, gameId);
  try {
    await confirmMatchResult(gameId, user.id);
  } catch (error) {
    redirect(`${back}?error=${encodeURIComponent(errorMessage(error))}`);
  }
  revalidatePath(back);
  redirect(back);
}

export async function recomputeWithRoundsAction(formData: FormData) {
  const user = await requireAdmin();
  const gameId = String(formData.get("gameId"));
  const back = rankedRedirectTo(formData, gameId);
  let rounds: RoundDraft[] = [];
  try {
    rounds = JSON.parse(String(formData.get("rounds") ?? "[]")) as RoundDraft[];
  } catch {
    rounds = [];
  }
  try {
    await recomputeWithRounds(gameId, rounds, user);
  } catch (error) {
    redirect(`${back}?error=${encodeURIComponent(errorMessage(error))}`);
  }
  revalidatePath(back);
  redirect(back);
}

export async function recomputeMatchAction(formData: FormData) {
  await requireAdmin();
  const gameId = String(formData.get("gameId"));
  const redirectTo = String(formData.get("redirectTo") ?? `/games/${gameId}`);
  try {
    await recomputeMatch(gameId);
  } catch (error) {
    redirect(`${redirectTo}?error=${encodeURIComponent(errorMessage(error))}`);
  }
  revalidatePath(`/games/${gameId}`);
  revalidatePath(`/organizer/games/${gameId}`);
  redirect(redirectTo);
}

export async function applyRatingNowAction(formData: FormData) {
  await requireAdmin();
  const gameId = String(formData.get("gameId"));
  const redirectTo = String(formData.get("redirectTo") ?? `/games/${gameId}`);
  try {
    await applyRating(gameId);
  } catch (error) {
    redirect(`${redirectTo}?error=${encodeURIComponent(errorMessage(error))}`);
  }
  revalidatePath(`/games/${gameId}`);
  revalidatePath(`/organizer/games/${gameId}`);
  redirect(redirectTo);
}

export async function addGuestAction(formData: FormData) {
  const user = await requireUser();
  const gameId = String(formData.get("gameId"));
  const name = formData.get("name") ? String(formData.get("name")) : null;
  try {
    await addGuest(user.id, gameId, name);
  } catch (error) {
    redirect(`/games/${gameId}?error=${encodeURIComponent(errorMessage(error))}`);
  }
  revalidatePath(`/games/${gameId}`);
  revalidatePath("/");
  redirect(`/games/${gameId}`);
}

export async function removeGuestAction(formData: FormData) {
  const user = await requireUser();
  const gameId = String(formData.get("gameId"));
  const guestId = String(formData.get("guestId"));
  try {
    await removeGuest(guestId, user);
  } catch (error) {
    redirect(`/games/${gameId}?error=${encodeURIComponent(errorMessage(error))}`);
  }
  revalidatePath(`/games/${gameId}`);
  revalidatePath("/");
  redirect(`/games/${gameId}`);
}

export async function updateGameAction(formData: FormData) {
  const organizer = await requireOrganizer();
  const gameId = String(formData.get("gameId"));
  const result = gameSchema.safeParse(Object.fromEntries(formData));
  if (!result.success) redirect(`/organizer/games/${gameId}?error=${encodeURIComponent("Check the game details and try again.")}`);
  const input = result.data;
  const currentGame = await prisma.game.findUnique({ where: { id: gameId } });
  if (!currentGame) throw new Error("Game not found");
  if (organizer.role !== "ADMIN" && currentGame.organizerId !== organizer.id) redirect("/organizer");
  const club = currentGame.clubId === input.clubId
    ? {
        city: currentGame.city,
        name: currentGame.club,
        address: currentGame.address,
        hourlyCourtPrice: currentGame.courtPricePerHour
      }
    : await getActiveClub(input.clubId);
  const courtPricePerHour = input.courtPricePerHour ?? club.hourlyCourtPrice;
  await prisma.game.update({
    where: { id: gameId },
    data: {
      ...input,
      city: club.city,
      club: club.name,
      address: club.address,
      courtPricePerHour,
      pricePerPlayer: calculatePricePerPlayer(courtPricePerHour, input.maxPlayers),
      startsAt: new Date(input.startsAt)
    }
  });
  revalidatePath(`/organizer/games/${gameId}`);
  revalidatePath(`/games/${gameId}`);
  redirect(`/organizer/games/${gameId}?saved=game`);
}

export async function setGameStatusAction(formData: FormData) {
  const organizer = await requireOrganizer();
  const gameId = String(formData.get("gameId"));
  const status = String(formData.get("status")) as GameStatusType;
  try {
    await updateGameStatus(gameId, status, organizer);
  } catch (error) {
    redirect(`/organizer/games/${gameId}?error=${encodeURIComponent(errorMessage(error))}`);
  }
  revalidatePath("/");
  revalidatePath(`/games/${gameId}`);
  revalidatePath(`/organizer/games/${gameId}`);
  redirect(`/organizer/games/${gameId}?saved=status`);
}

export async function deleteGameAction(formData: FormData) {
  const admin = await requireAdmin();
  const gameId = String(formData.get("gameId"));
  try {
    await deleteGame(gameId, admin);
  } catch (error) {
    redirect(`/organizer/games/${gameId}?error=${encodeURIComponent(errorMessage(error))}`);
  }
  revalidatePath("/");
  revalidatePath("/organizer");
  revalidatePath("/ranking");
  redirect("/organizer?deleted=1");
}

export async function participationAction(formData: FormData) {
  const organizer = await requireOrganizer();
  const participationId = String(formData.get("participationId"));
  const gameId = String(formData.get("gameId"));
  const action = String(formData.get("action"));

  try {
    if (action === "paid") await updateParticipation(participationId, { paymentStatus: PaymentStatus.PAID }, organizer);
    if (action === "unpaid") await updateParticipation(participationId, { paymentStatus: PaymentStatus.UNPAID }, organizer);
    if (action === "no_show") await updateParticipation(participationId, { status: ParticipationStatus.NO_SHOW }, organizer);
    if (action === "played") await updateParticipation(participationId, { status: ParticipationStatus.PLAYED }, organizer);
    if (action === "joined") await updateParticipation(participationId, { status: ParticipationStatus.JOINED }, organizer);
    if (action === "waiting") await updateParticipation(participationId, { status: ParticipationStatus.WAITING }, organizer);
  } catch (error) {
    redirect(`/organizer/games/${gameId}?error=${encodeURIComponent(errorMessage(error))}`);
  }

  revalidatePath("/organizer");
  revalidatePath(`/organizer/games/${gameId}`);
  redirect(`/organizer/games/${gameId}?saved=participant`);
}

export async function addParticipantsAction(formData: FormData) {
  const manager = await requireOrganizer();
  const gameId = String(formData.get("gameId"));
  const game = await prisma.game.findUnique({ where: { id: gameId }, select: { organizerId: true } });
  if (!game) redirect("/organizer");
  if (manager.role !== "ADMIN" && game.organizerId !== manager.id) redirect("/organizer");
  const userIds = Array.from(new Set(formData.getAll("userIds").map(String).filter(Boolean)));
  if (!userIds.length) redirect(`/organizer/games/${gameId}?error=${encodeURIComponent("Select at least one player.")}`);

  const failures: string[] = [];
  let added = 0;
  for (const userId of userIds) {
    try {
      await addParticipantToGame(userId, gameId);
      added += 1;
    } catch (error) {
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true, lastName: true } });
      const label = user ? `${user.name} ${user.lastName ?? ""}`.trim() : "Player";
      failures.push(`${label}: ${errorMessage(error)}`);
    }
  }

  revalidatePath("/organizer");
  revalidatePath(`/organizer/games/${gameId}`);
  if (failures.length) {
    const summary = `Added ${added} of ${userIds.length} players. ${failures.join("; ")}`;
    redirect(`/organizer/games/${gameId}?error=${encodeURIComponent(summary)}`);
  }
  redirect(`/organizer/games/${gameId}?saved=participants`);
}

async function getActiveClub(clubId: string) {
  const club = await prisma.club.findFirst({
    where: { id: clubId, deletedAt: null }
  });
  if (!club) throw new Error("Club not found");
  return club;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unable to complete the action.";
}
