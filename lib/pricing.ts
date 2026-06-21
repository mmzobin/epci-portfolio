import { Prisma } from "@prisma/client";

export function calculatePricePerPlayer(courtPricePerHour: Prisma.Decimal.Value, maxPlayers: number) {
  const safeMaxPlayers = maxPlayers > 0 ? maxPlayers : 1;
  return new Prisma.Decimal(courtPricePerHour).div(safeMaxPlayers).toDecimalPlaces(2);
}

export function formatMoney(value: Prisma.Decimal.Value) {
  return new Prisma.Decimal(value).toFixed(2);
}
