export type TripType = "ONE_WAY" | "ROUND_TRIP" | "MULTI_CITY";
export type CabinClass = "ECONOMY" | "PREMIUM_ECONOMY" | "BUSINESS" | "FIRST";

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

export type FlightSortKey = "price" | "duration";

export interface FlightSearchResponse {
  searchId: string;
  offers: FlightOffer[];
  totalCount: number;
  filteredCount: number;
  availableAirlineCodes: string[];
  expiresAt: string;
  tripType: TripType;
  adults: number;
  children: number;
  infants: number;
}
