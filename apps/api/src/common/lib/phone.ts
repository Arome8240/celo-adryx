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

/** Splits into Amadeus's expected {countryCallingCode, number} shape (e.g. "234" / "8012345678"), or null if invalid. */
export function splitPhoneNumber(
  input: string,
): { countryCallingCode: string; number: string } | null {
  const parsed = parsePhoneNumberFromString(input);
  if (!parsed?.isValid()) return null;
  return {
    countryCallingCode: parsed.countryCallingCode,
    number: parsed.nationalNumber,
  };
}
