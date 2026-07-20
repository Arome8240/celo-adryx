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

// Amadeus returns name/city/country fields in ALL CAPS — title-case them so
// results read consistently with the local fallback list's normal casing.
function titleCase(value: string): string {
  return value.replace(
    /[A-Za-z]+/g,
    (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
  );
}

export function normalizeAmadeusLocation(
  raw: AmadeusLocationRaw,
): AirportSummary | null {
  if (!raw.iataCode || !raw.name || !raw.address?.countryCode) return null;
  return {
    iataCode: raw.iataCode,
    name: titleCase(raw.name),
    city: titleCase(raw.address.cityName ?? raw.name),
    country: titleCase(raw.address.countryName ?? raw.address.countryCode),
    countryCode: raw.address.countryCode,
  };
}
