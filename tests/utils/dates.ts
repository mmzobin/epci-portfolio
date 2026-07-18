export function futureDateTimeLocal(daysFromNow = 7) {
  const date = new Date(Date.now() + daysFromNow * 24 * 60 * 60 * 1_000);
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);

  return localDate.toISOString().slice(0, 16);
}
