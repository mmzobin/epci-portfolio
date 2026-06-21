import { existsSync, readFileSync } from "fs";
import { PrismaClient } from "@prisma/client";

type DemoParticipationFix = {
  gameTitle: string;
  fromEmail: string;
  toEmail: string;
};

const fixes: DemoParticipationFix[] = [
  { gameTitle: "Full Herzliya Match", fromEmail: "maya@padel.test", toEmail: "mmzobin@gmail.com" },
  { gameTitle: "Past Tel Aviv Match", fromEmail: "maya@padel.test", toEmail: "daniel@padel.test" },
  { gameTitle: "Past Full Herzliya Match", fromEmail: "maya@padel.test", toEmail: "tom@padel.test" },
  { gameTitle: "Cancelled Rishon Le Zion Game", fromEmail: "eli@padel.test", toEmail: "nina@padel.test" }
];

loadEnv();

const apply = process.argv.includes("--apply");
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DIRECT_URL ?? process.env.DATABASE_URL
    }
  }
});

async function main() {
  console.log(apply ? "Applying demo participation level fixes..." : "Dry run: demo participation level fixes");

  for (const fix of fixes) {
    await applyFix(fix);
  }

  const mismatches = await currentMismatches();
  if (mismatches.length > 0) {
    console.log(apply ? "\nRemaining mismatches:" : "\nCurrent mismatches:");
    for (const mismatch of mismatches) {
      console.log(`- ${mismatch.gameTitle}: ${mismatch.email} level ${mismatch.level} outside ${mismatch.minLevel}-${mismatch.maxLevel} (${mismatch.status})`);
    }
    if (apply) {
      throw new Error("Some demo participations are still outside their game level range.");
    }
  } else {
    console.log("\nNo demo participation level mismatches found.");
  }

  if (!apply) {
    console.log("Run with --apply to update the database.");
  }
}

async function applyFix(fix: DemoParticipationFix) {
  const game = await prisma.game.findFirst({
    where: { title: fix.gameTitle },
    select: { id: true, title: true, minLevel: true, maxLevel: true }
  });

  if (!game) {
    console.log(`- ${fix.gameTitle}: skipped, game not found`);
    return;
  }

  const fromUser = await prisma.user.findUnique({
    where: { email: fix.fromEmail },
    select: { id: true, email: true, level: true }
  });
  const toUser = await prisma.user.findUnique({
    where: { email: fix.toEmail },
    select: { id: true, email: true, level: true }
  });

  if (!fromUser || !toUser) {
    throw new Error(`${fix.gameTitle}: expected users were not found (${fix.fromEmail} -> ${fix.toEmail}).`);
  }
  if (toUser.level < game.minLevel || toUser.level > game.maxLevel) {
    throw new Error(`${fix.gameTitle}: ${toUser.email} level ${toUser.level} is outside ${game.minLevel}-${game.maxLevel}.`);
  }

  const oldParticipation = await prisma.participation.findUnique({
    where: { userId_gameId: { userId: fromUser.id, gameId: game.id } },
    select: { id: true, status: true }
  });
  const newParticipation = await prisma.participation.findUnique({
    where: { userId_gameId: { userId: toUser.id, gameId: game.id } },
    select: { id: true }
  });

  if (!oldParticipation) {
    if (newParticipation) {
      console.log(`- ${game.title}: already fixed (${toUser.email})`);
      return;
    }

    console.log(`- ${game.title}: skipped, ${fromUser.email} participation not found`);
    return;
  }

  if (newParticipation) {
    throw new Error(`${game.title}: cannot move ${fromUser.email} to ${toUser.email}; target participation already exists.`);
  }

  const summary = `${game.title}: ${fromUser.email} -> ${toUser.email} (${oldParticipation.status})`;
  if (!apply) {
    console.log(`- would update ${summary}`);
    return;
  }

  await prisma.participation.update({
    where: { id: oldParticipation.id },
    data: { userId: toUser.id }
  });
  console.log(`- updated ${summary}`);
}

async function currentMismatches() {
  return prisma.$queryRaw<Array<{ gameTitle: string; email: string; level: number; minLevel: number; maxLevel: number; status: string }>>`
    SELECT g.title AS "gameTitle", u.email, u.level, g."minLevel", g."maxLevel", p.status
    FROM "Participation" p
    JOIN "Game" g ON g.id = p."gameId"
    JOIN "User" u ON u.id = p."userId"
    WHERE g.title IN (
      'Full Herzliya Match',
      'Past Tel Aviv Match',
      'Past Full Herzliya Match',
      'Cancelled Rishon Le Zion Game'
    )
    AND (u.level < g."minLevel" OR u.level > g."maxLevel")
    ORDER BY g.title, p.status, u.email
  `;
}

function loadEnv() {
  if (!existsSync(".env")) return;

  for (const line of readFileSync(".env", "utf8").split(/\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separator = trimmed.indexOf("=");
    if (separator <= 0) continue;

    const key = trimmed.slice(0, separator);
    const value = trimmed.slice(separator + 1).replace(/^"|"$/g, "");
    process.env[key] = value;
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
