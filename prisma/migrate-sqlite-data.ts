import { execFileSync } from "child_process";
import { existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DIRECT_URL ?? process.env.DATABASE_URL
    }
  }
});
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sqliteFile = process.env.SQLITE_DATABASE_FILE ?? path.join(__dirname, "dev.db");

type SqliteValue = string | number | null;
type SqliteRow = Record<string, SqliteValue>;

function readTable(table: "User" | "Club" | "Game" | "Participation") {
  const quotedTable = `"${table.replace(/"/g, '""')}"`;
  const output = execFileSync("sqlite3", [sqliteFile, "-json", `SELECT * FROM ${quotedTable};`], {
    encoding: "utf8"
  });

  return JSON.parse(output || "[]") as SqliteRow[];
}

function nullableString(value: SqliteValue) {
  return value === null ? null : String(value);
}

function nullableDate(value: SqliteValue) {
  return value === null ? null : parseSqliteDate(value);
}

function requiredDate(value: SqliteValue) {
  if (value === null) throw new Error("Expected a date value");
  return parseSqliteDate(value);
}

function parseSqliteDate(value: SqliteValue) {
  const date = typeof value === "number" || /^\d+$/.test(String(value))
    ? new Date(Number(value))
    : new Date(String(value));

  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid SQLite date value: ${value}`);
  }

  return date;
}

async function main() {
  if (!existsSync(sqliteFile)) {
    throw new Error(`SQLite database was not found at ${sqliteFile}`);
  }

  const users = readTable("User");
  const clubs = readTable("Club");
  const games = readTable("Game");
  const participations = readTable("Participation");

  await prisma.participation.deleteMany();
  await prisma.game.deleteMany();
  await prisma.club.deleteMany();
  await prisma.user.deleteMany();

  if (users.length > 0) {
      await prisma.user.createMany({
        data: users.map((user) => ({
          id: String(user.id),
          name: String(user.name),
          lastName: String(user.lastName),
          email: String(user.email),
          passwordHash: String(user.passwordHash),
          phone: nullableString(user.phone),
          telegramUsername: nullableString(user.telegramUsername),
          photoUrl: nullableString(user.photoUrl),
          city: nullableString(user.city),
          level: Number(user.level),
          levelAssessmentScore: user.levelAssessmentScore === null ? null : Number(user.levelAssessmentScore),
          levelAssessmentDate: nullableDate(user.levelAssessmentDate),
          role: String(user.role),
          gamesCount: Number(user.gamesCount),
          cancellations: Number(user.cancellations),
          noShows: Number(user.noShows),
          createdAt: requiredDate(user.createdAt)
        }))
      });
  }

  if (clubs.length > 0) {
      await prisma.club.createMany({
        data: clubs.map((club) => ({
          id: String(club.id),
          name: String(club.name),
          city: String(club.city),
          address: String(club.address),
          hourlyCourtPrice: String(club.hourlyCourtPrice),
          createdAt: requiredDate(club.createdAt),
          updatedAt: requiredDate(club.updatedAt),
          deletedAt: nullableDate(club.deletedAt)
        }))
      });
  }

  if (games.length > 0) {
      await prisma.game.createMany({
        data: games.map((game) => ({
          id: String(game.id),
          title: String(game.title),
          startsAt: requiredDate(game.startsAt),
          city: String(game.city),
          club: String(game.club),
          clubId: nullableString(game.clubId),
          address: String(game.address),
          courtNumber: String(game.courtNumber),
          courtPricePerHour: String(game.courtPricePerHour),
          maxPlayers: Number(game.maxPlayers),
          pricePerPlayer: String(game.pricePerPlayer),
          minLevel: Number(game.minLevel),
          maxLevel: Number(game.maxLevel),
          organizerId: String(game.organizerId),
          status: String(game.status),
          createdAt: requiredDate(game.createdAt),
          updatedAt: requiredDate(game.updatedAt)
        }))
      });
  }

  if (participations.length > 0) {
      await prisma.participation.createMany({
        data: participations.map((participation) => ({
          id: String(participation.id),
          userId: String(participation.userId),
          gameId: String(participation.gameId),
          status: String(participation.status),
          paymentStatus: String(participation.paymentStatus),
          paidAt: nullableDate(participation.paidAt),
          paidById: nullableString(participation.paidById),
          noShowMarkedAt: nullableDate(participation.noShowMarkedAt),
          noShowMarkedById: nullableString(participation.noShowMarkedById),
          createdAt: requiredDate(participation.createdAt),
          updatedAt: requiredDate(participation.updatedAt)
        }))
      });
  }

  console.log(`Migrated ${users.length} users, ${clubs.length} clubs, ${games.length} games, ${participations.length} participations from ${sqliteFile}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
