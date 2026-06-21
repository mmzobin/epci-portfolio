import bcrypt from "bcryptjs";
import { createClient } from "@supabase/supabase-js";
import { fileURLToPath } from "url";
import { prisma } from "../lib/prisma";
import { GameStatus, ParticipationStatus, PaymentStatus, TournamentParticipantStatus, TournamentStatus, UserRole } from "../lib/statuses";
import { tournamentPoints } from "../lib/tournaments";

const avatarBucket = "avatars";

const seedUserIds = {
  admin: "cmq5hmdbk00188iadahxx2hkb",
  michael: "cmq5hmeff00198iadkg0kufzl",
  oleg: "cmq5hmfrc001a8iadrqb58bqa",
  daniel: "cmq5hmgv5001b8iad8ae3tzy1",
  maya: "cmq5hmhz1001c8iad5pp1k5lk",
  sam: "cmq5hmj2y001d8iad4hdkxra2",
  eli: "cmq5hmk6t001e8iadewjr1vi9",
  tom: "cmq5hmlat001f8iadzsx0ekdo",
  nina: "cmq5hmmf7001g8iadsdpbxpdk"
} as const;

export async function seed() {
  // Deletes are grouped by FK dependency level; everything else below runs in
  // parallel waves — over a remote DB each round-trip costs hundreds of ms.
  await Promise.all([prisma.tournamentParticipation.deleteMany(), prisma.participation.deleteMany(), prisma.guest.deleteMany()]);
  await Promise.all([prisma.tournament.deleteMany(), prisma.game.deleteMany()]);
  await Promise.all([prisma.club.deleteMany(), prisma.user.deleteMany()]);

  const [passwordHash, avatars] = await Promise.all([
    bcrypt.hash("Password123!", 10),
    Promise.all(Object.values(seedUserIds).map((id) => findSeedAvatar(id))).then(
      (found) => Object.fromEntries(Object.keys(seedUserIds).map((key, index) => [key, found[index]])) as Record<keyof typeof seedUserIds, { avatarPath?: string; photoUrl?: string }>
    )
  ]);
  const assessmentDate = new Date("2026-06-01T10:00:00.000Z");
  const users = await Promise.all([
    prisma.user.create({
      data: { id: seedUserIds.admin, name: "Admin", lastName: "Padel", email: "admin@padel.test", passwordHash, city: "Tel Aviv", level: 4.0, levelAssessmentScore: 34, levelAssessmentDate: assessmentDate, role: UserRole.ADMIN, phone: "+972500000001", telegramUsername: "user_admin", ...avatars.admin }
    }),
    prisma.user.create({
      data: { id: seedUserIds.michael, name: "Michael", lastName: "Zobin", email: "mmzobin@gmail.com", passwordHash, city: "Rishon Le Zion", level: 3.5, levelAssessmentScore: 29, levelAssessmentDate: assessmentDate, role: UserRole.ADMIN, phone: "+972500000002", telegramUsername: "user_michael", ...avatars.michael }
    }),
    prisma.user.create({
      data: { id: seedUserIds.oleg, name: "Oleg", lastName: "Petrov", email: "oleg@padel.test", passwordHash, city: "Bnei Brak", level: 3.5, levelAssessmentScore: 30, levelAssessmentDate: assessmentDate, role: UserRole.ORGANIZER, phone: "+972500000003", telegramUsername: "user_oleg", ...avatars.oleg }
    }),
    prisma.user.create({
      data: { id: seedUserIds.daniel, name: "Daniel", lastName: "Cohen", email: "daniel@padel.test", passwordHash, city: "Tel Aviv", level: 3.5, levelAssessmentScore: 29, levelAssessmentDate: assessmentDate, role: UserRole.ORGANIZER, phone: "+972500000004", telegramUsername: "user_daniel", ...avatars.daniel }
    }),
    prisma.user.create({
      data: { id: seedUserIds.maya, name: "Maya", lastName: "Levi", email: "maya@padel.test", passwordHash, city: "Holon", level: 2.0, levelAssessmentScore: 15, levelAssessmentDate: assessmentDate, role: UserRole.PLAYER, phone: "+972500000005", telegramUsername: "user_maya", ...avatars.maya }
    }),
    prisma.user.create({
      data: { id: seedUserIds.sam, name: "Sam", lastName: "Klein", email: "sam@padel.test", passwordHash, city: "Tel Aviv", level: 3.5, levelAssessmentScore: 30, levelAssessmentDate: assessmentDate, role: UserRole.PLAYER, phone: "+972500000006", telegramUsername: "user_sam", ...avatars.sam }
    }),
    prisma.user.create({
      data: { id: seedUserIds.eli, name: "Eli", lastName: "Katz", email: "eli@padel.test", passwordHash, city: "Tel Aviv", level: 3.5, levelAssessmentScore: 29, levelAssessmentDate: assessmentDate, role: UserRole.PLAYER, phone: "+972500000007", telegramUsername: "user_eli", ...avatars.eli }
    }),
    prisma.user.create({
      data: { id: seedUserIds.tom, name: "Tom", lastName: "Bauer", email: "tom@padel.test", passwordHash, city: "Holon", level: 3.5, levelAssessmentScore: 27, levelAssessmentDate: assessmentDate, role: UserRole.PLAYER, phone: "+972500000008", telegramUsername: "user_tom", ...avatars.tom }
    }),
    prisma.user.create({
      data: { id: seedUserIds.nina, name: "Nina", lastName: "Ros", email: "nina@padel.test", passwordHash, city: "Bat Yam", level: 2.0, levelAssessmentScore: 15, levelAssessmentDate: assessmentDate, role: UserRole.PLAYER, phone: "+972500000009", telegramUsername: "user_nina", ...avatars.nina }
    })
  ]);

  const organizer = users[2];
  const players = users.slice(3);
  const [admin, michael, oleg, daniel, maya, , eli, , nina] = users;
  // Service account: hidden from ranking and player pickers.
  await prisma.user.update({ where: { id: seedUserIds.admin }, data: { hidden: true } as never });
  const now = new Date();
  const soon = (days: number, hour: number) => new Date(now.getFullYear(), now.getMonth(), now.getDate() + days, hour, 0, 0);
  const clubs = await Promise.all([
    prisma.club.create({ data: { city: "Tel Aviv", name: "Tel Aviv Padel Center", address: "12 Herzl St", hourlyCourtPrice: "220.00" } }),
    prisma.club.create({ data: { city: "Herzliya", name: "Herzliya Padel Arena", address: "5 Marina Ave", hourlyCourtPrice: "220.00" } }),
    prisma.club.create({ data: { city: "Holon", name: "Holon Padel House", address: "20 Sokolov St", hourlyCourtPrice: "200.00" } }),
    prisma.club.create({ data: { city: "Rishon Le Zion", name: "Rishon Padel Park", address: "8 Rothschild St", hourlyCourtPrice: "200.00" } }),
    prisma.club.create({ data: { city: "Tel Aviv", name: "City Courts Tel Aviv", address: "3 Allenby St", hourlyCourtPrice: "220.00" } })
  ]);
  const [padelTelAviv, steeleHerzliya, padelHolon, padelRishon] = clubs;

  const openGamePromise = prisma.game.create({
    data: {
      title: "Evening Padel Tel Aviv",
      startsAt: soon(3, 20),
      city: padelTelAviv.city,
      club: padelTelAviv.name,
      clubId: padelTelAviv.id,
      address: padelTelAviv.address,
      courtNumber: "1",
      courtPricePerHour: padelTelAviv.hourlyCourtPrice,
      maxPlayers: 4,
      pricePerPlayer: "55.00",
      minLevel: 2.5,
      maxLevel: 4.0,
      organizerId: organizer.id,
      status: GameStatus.OPEN
    }
  });

  const fullGamePromise = prisma.game.create({
    data: {
      title: "Full Herzliya Match",
      startsAt: soon(5, 19),
      city: steeleHerzliya.city,
      club: steeleHerzliya.name,
      clubId: steeleHerzliya.id,
      address: steeleHerzliya.address,
      courtNumber: "2",
      courtPricePerHour: steeleHerzliya.hourlyCourtPrice,
      maxPlayers: 4,
      pricePerPlayer: "55.00",
      minLevel: 3.0,
      maxLevel: 4.5,
      organizerId: organizer.id,
      status: GameStatus.FULL
    }
  });

  const completedGamePromise = prisma.game.create({
    data: {
      title: "Completed Holon Game",
      startsAt: soon(-7, 18),
      city: padelHolon.city,
      club: padelHolon.name,
      clubId: padelHolon.id,
      address: padelHolon.address,
      courtNumber: "3",
      courtPricePerHour: padelHolon.hourlyCourtPrice,
      maxPlayers: 4,
      pricePerPlayer: "50.00",
      minLevel: 2.0,
      maxLevel: 3.5,
      organizerId: organizer.id,
      status: GameStatus.COMPLETED
    }
  });

  const pastOpenGamePromise = prisma.game.create({
    data: {
      title: "Past Tel Aviv Match",
      startsAt: soon(-1, 20),
      city: padelTelAviv.city,
      club: padelTelAviv.name,
      clubId: padelTelAviv.id,
      address: padelTelAviv.address,
      courtNumber: "5",
      courtPricePerHour: padelTelAviv.hourlyCourtPrice,
      maxPlayers: 4,
      pricePerPlayer: "55.00",
      minLevel: 2.5,
      maxLevel: 4.0,
      organizerId: organizer.id,
      status: GameStatus.OPEN
    }
  });

  const pastFullGamePromise = prisma.game.create({
    data: {
      title: "Past Full Herzliya Match",
      startsAt: soon(-1, 19),
      city: steeleHerzliya.city,
      club: steeleHerzliya.name,
      clubId: steeleHerzliya.id,
      address: steeleHerzliya.address,
      courtNumber: "6",
      courtPricePerHour: steeleHerzliya.hourlyCourtPrice,
      maxPlayers: 4,
      pricePerPlayer: "55.00",
      minLevel: 3.0,
      maxLevel: 4.5,
      organizerId: organizer.id,
      status: GameStatus.FULL
    }
  });

  const cancelledGamePromise = prisma.game.create({
    data: {
      title: "Cancelled Rishon Le Zion Game",
      startsAt: soon(4, 21),
      city: padelRishon.city,
      club: padelRishon.name,
      clubId: padelRishon.id,
      address: padelRishon.address,
      courtNumber: "4",
      courtPricePerHour: padelRishon.hourlyCourtPrice,
      maxPlayers: 4,
      pricePerPlayer: "50.00",
      minLevel: 1.5,
      maxLevel: 3.0,
      organizerId: organizer.id,
      status: GameStatus.CANCELLED
    }
  });

  const [openGame, fullGame, completedGame, pastOpenGame, pastFullGame, cancelledGame] = await Promise.all([
    openGamePromise, fullGamePromise, completedGamePromise, pastOpenGamePromise, pastFullGamePromise, cancelledGamePromise
  ]);

  await prisma.participation.createMany({
    data: [
      { userId: players[0].id, gameId: openGame.id, status: ParticipationStatus.JOINED, paymentStatus: PaymentStatus.UNPAID },
      { userId: players[0].id, gameId: fullGame.id, status: ParticipationStatus.JOINED, paymentStatus: PaymentStatus.UNPAID },
      { userId: michael.id, gameId: fullGame.id, status: ParticipationStatus.JOINED, paymentStatus: PaymentStatus.PAID },
      { userId: players[2].id, gameId: fullGame.id, status: ParticipationStatus.JOINED, paymentStatus: PaymentStatus.UNPAID },
      { userId: players[3].id, gameId: fullGame.id, status: ParticipationStatus.JOINED, paymentStatus: PaymentStatus.UNPAID },
      { userId: players[4].id, gameId: fullGame.id, status: ParticipationStatus.WAITING, paymentStatus: PaymentStatus.UNPAID },
      { userId: players[0].id, gameId: completedGame.id, status: ParticipationStatus.PLAYED, paymentStatus: PaymentStatus.PAID },
      { userId: players[1].id, gameId: completedGame.id, status: ParticipationStatus.PLAYED, paymentStatus: PaymentStatus.PAID },
      { userId: players[2].id, gameId: completedGame.id, status: ParticipationStatus.NO_SHOW, paymentStatus: PaymentStatus.UNPAID },
      { userId: players[0].id, gameId: pastOpenGame.id, status: ParticipationStatus.JOINED, paymentStatus: PaymentStatus.PAID },
      { userId: players[2].id, gameId: pastOpenGame.id, status: ParticipationStatus.JOINED, paymentStatus: PaymentStatus.UNPAID },
      { userId: players[0].id, gameId: pastFullGame.id, status: ParticipationStatus.JOINED, paymentStatus: PaymentStatus.UNPAID },
      { userId: players[4].id, gameId: pastFullGame.id, status: ParticipationStatus.JOINED, paymentStatus: PaymentStatus.UNPAID },
      { userId: players[2].id, gameId: pastFullGame.id, status: ParticipationStatus.JOINED, paymentStatus: PaymentStatus.UNPAID },
      { userId: players[3].id, gameId: pastFullGame.id, status: ParticipationStatus.JOINED, paymentStatus: PaymentStatus.UNPAID },
      { userId: nina.id, gameId: cancelledGame.id, status: ParticipationStatus.CANCELLED, paymentStatus: PaymentStatus.UNPAID }
    ]
  });

  const [, , , seedTournament] = await Promise.all([
    prisma.user.update({ where: { id: players[0].id }, data: { gamesCount: 1 } }),
    prisma.user.update({ where: { id: players[1].id }, data: { gamesCount: 1 } }),
    prisma.user.update({ where: { id: players[2].id }, data: { noShows: 1 } }),
    prisma.tournament.create({
    data: {
      title: "EPCI Seed Mini Tournament",
      startsAt: soon(-2, 19),
      city: "Tel Aviv",
      club: padelTelAviv.name,
      format: "MINI",
      status: TournamentStatus.COMPLETED,
      createdById: admin.id,
      completedAt: soon(-2, 22)
    }
    })
  ]);

  await prisma.tournamentParticipation.createMany({
    data: [
      tournamentResult(seedTournament.id, maya.id, 7, 5, 1),
      tournamentResult(seedTournament.id, nina.id, 7, 4, 2),
      tournamentResult(seedTournament.id, michael.id, 6, 4, 3),
      tournamentResult(seedTournament.id, eli.id, 5, 3, 4),
      tournamentResult(seedTournament.id, oleg.id, 7, 2, 5),
      tournamentResult(seedTournament.id, daniel.id, 5, 2, 6)
    ]
  });
}

function tournamentResult(tournamentId: string, userId: string, matchesPlayed: number, wins: number, place: number) {
  return {
    tournamentId,
    userId,
    status: TournamentParticipantStatus.JOINED,
    matchesPlayed,
    wins,
    tournamentPoints: tournamentPoints(matchesPlayed, wins),
    place
  };
}

async function findSeedAvatar(userId: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) return {};

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false
    }
  });

  const directory = `users/${userId}`;
  const { data, error } = await supabase.storage.from(avatarBucket).list(directory, {
    limit: 100,
    sortBy: { column: "created_at", order: "desc" }
  });

  if (error || !data?.length) return {};

  const latestAvatar = data
    .filter((item) => item.name.startsWith("avatar-"))
    .sort((a, b) => avatarTimestamp(b) - avatarTimestamp(a))[0];

  if (!latestAvatar) return {};

  const avatarPath = `${directory}/${latestAvatar.name}`;
  const { data: publicUrlData } = supabase.storage.from(avatarBucket).getPublicUrl(avatarPath);

  return {
    avatarPath,
    photoUrl: publicUrlData.publicUrl
  };
}

function avatarTimestamp(item: { name: string; updated_at?: string | null; created_at?: string | null }) {
  const dateValue = item.updated_at ?? item.created_at;
  if (dateValue) return new Date(dateValue).getTime();

  const match = item.name.match(/^avatar-(\d+)/);
  return match ? Number(match[1]) : 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  seed()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
}
