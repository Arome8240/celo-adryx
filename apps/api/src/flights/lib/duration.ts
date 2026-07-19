const ISO_DURATION_REGEX = /^PT(?:(\d+)H)?(?:(\d+)M)?$/;

/** Single shared ISO-8601 duration parser — one copy, used everywhere a segment/itinerary duration is parsed. */
export function parseIsoDurationToMinutes(duration: string): number {
  const match = ISO_DURATION_REGEX.exec(duration);
  if (!match) return 0;
  const hours = Number(match[1] ?? 0);
  const minutes = Number(match[2] ?? 0);
  return hours * 60 + minutes;
}
