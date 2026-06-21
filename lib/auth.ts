import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@/lib/statuses";

const sessionCookie = "padel_session";

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export function setSession(userId: string) {
  // Inside Telegram the Mini App runs in an embedded/third-party context
  // (iframe on Desktop, webview on mobile). A SameSite=Lax cookie is NOT sent
  // with background POSTs (server actions, fetch) there, which silently logs the
  // user out on the first authenticated action. SameSite=None + Secure fixes it.
  // In local dev (http) we keep Lax so the cookie still works without HTTPS.
  const secure = process.env.NODE_ENV === "production";
  cookies().set(sessionCookie, userId, {
    httpOnly: true,
    sameSite: secure ? "none" : "lax",
    secure,
    path: "/",
    maxAge: 60 * 60 * 24 * 30
  });
}

export function clearSession() {
  cookies().delete(sessionCookie);
}

export async function getCurrentUser() {
  const userId = cookies().get(sessionCookie)?.value;
  if (!userId) return null;

  const select = {
    id: true,
    name: true,
    lastName: true,
    email: true,
    phone: true,
    telegramUsername: true,
    photoUrl: true,
    avatarPath: true,
    city: true,
    level: true,
    role: true,
    gamesCount: true,
    cancellations: true,
    noShows: true,
    levelAssessmentScore: true,
    levelAssessmentDate: true,
    createdAt: true
  };
  // skillRating / ratedGames aren't in the sandbox Prisma client type yet; they
  // exist in the DB and are added to the runtime select via the cast below, so
  // effectiveRating() reads the live game rating instead of falling back to level.
  return prisma.user.findUnique({
    where: { id: userId },
    select: { ...select, skillRating: true, ratedGames: true } as typeof select
  });
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireOrganizer() {
  const user = await requireUser();
  if (!([UserRole.ORGANIZER, UserRole.ADMIN] as readonly string[]).includes(user.role)) redirect("/");
  return user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== UserRole.ADMIN) redirect("/");
  return user;
}
