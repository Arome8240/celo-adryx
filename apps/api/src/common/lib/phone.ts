import { parsePhoneNumberFromString } from 'libphonenumber-js';

/**
 * MiniPay has no single home country, so — unlike adryxflight's
 * Nigeria-only validator — this requires a full E.164 number (explicit
 * "+countrycode...") rather than defaulting to one country.
 */
export function isValidPhoneNumber(input: string): boolean {
  if (!input.startsWith('+')) return false;
  const parsed = parsePhoneNumberFromString(input);
  return !!parsed?.isValid();
}

/** Returns the E.164-normalized form, or null if invalid. */
export function normalizePhoneNumber(input: string): string | null {
  const parsed = parsePhoneNumberFromString(input);
  return parsed?.isValid() ? parsed.number : null;
}
