import type { AirportSummary } from '../types/flight.types';

export interface AmadeusLocationRaw {
  subType?: string;
  iataCode?: string;
  name?: string;
  address?: {
    cityName?: string;
    countryName?: string;
    countryCode?: string;
  };
}

export function normalizeAmadeusLocation(
  raw: AmadeusLocationRaw,
): AirportSummary | null {
  if (!raw.iataCode || !raw.name || !raw.address?.countryCode) return null;
  return {
    iataCode: raw.iataCode,
    name: raw.name,
    city: raw.address.cityName ?? raw.name,
    country: raw.address.countryName ?? raw.address.countryCode,
    countryCode: raw.address.countryCode,
  };
}
