import { expect } from "@playwright/test";
import { prisma } from "@/lib/prisma";

export async function getGameIdByTitle(title: string) {
  const game = await prisma.game.findFirst({ where: { title }, select: { id: true } });
  expect(game, `Game titled "${title}" should exist in seed data`).not.toBeNull();
  return game!.id;
}
