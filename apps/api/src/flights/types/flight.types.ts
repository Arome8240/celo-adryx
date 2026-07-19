import type { CabinClass, TripType } from '../../../generated/prisma/client';

export type { CabinClass, TripType };

export interface FlightSearchSegmentInput {
  origin: string;
  destination: string;
  departureDate: string;
}

export interface FlightSearchParams {
  tripType: TripType;
  segments: FlightSearchSegmentInput[];
  adults: number;
  children: number;
  infants: number;
  cabinClass: CabinClass;
}

export interface AirportSummary {
  iataCode: string;
  name: string;
  city: string;
  country: string;
  countryCode: string;
}

export interface FlightItinerarySegment {
  origin: string;
  destination: string;
  departureAt: string;
  arrivalAt: string;
  carrierCode: string;
  flightNumber: string;
  durationMinutes: number;
}

export interface FlightItinerary {
  segments: FlightItinerarySegment[];
  durationMinutes: number;
  stops: number;
}

export interface FlightOffer {
  id: string;
  itineraries: FlightItinerary[];
  currency: string;
  totalPriceMinor: number;
  basePriceMinor: number;
  cabinClass: CabinClass;
  airlineCodes: string[];
  refundable: boolean;
}

export type FlightSortKey = 'price' | 'duration';

export interface FlightSearchResponse {
  searchId: string;
  offers: FlightOffer[];
  totalCount: number;
  filteredCount: number;
  /** Every airline present in the full (unfiltered) result set — so a filter UI doesn't shrink its own option list. */
  availableAirlineCodes: string[];
  expiresAt: string;
  tripType: TripType;
  adults: number;
  children: number;
  infants: number;
}

export interface FlightSearchFilters {
  maxStops?: number;
  minPriceMinor?: number;
  maxPriceMinor?: number;
  airlineCodes?: string[];
  sort?: FlightSortKey;
}
