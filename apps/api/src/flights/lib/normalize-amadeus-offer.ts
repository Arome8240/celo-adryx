import type {
  CabinClass,
  FlightItinerary,
  FlightItinerarySegment,
  FlightOffer,
} from '../types/flight.types';
import { parseIsoDurationToMinutes } from './duration';

export interface AmadeusOfferRaw {
  id: string;
  itineraries: Array<{
    duration: string;
    segments: Array<{
      departure: { iataCode: string; at: string };
      arrival: { iataCode: string; at: string };
      carrierCode: string;
      number: string;
      duration: string;
    }>;
  }>;
  price: { currency: string; total: string; base: string };
  validatingAirlineCodes?: string[];
  travelerPricings?: Array<{
    /** Correlates a traveler in this offer's pricing to the `travelers[].id` sent to Flight Create Orders. */
    travelerId?: string;
    fareDetailsBySegment?: Array<{ cabin?: string }>;
  }>;
}

function toMinorUnits(amount: string): number {
  return Math.round(parseFloat(amount) * 100);
}

/** The boundary that keeps Amadeus's raw offer schema from leaking into our domain model. */
export function normalizeAmadeusOffer(
  raw: AmadeusOfferRaw,
  requestedCabin: CabinClass,
): FlightOffer {
  const itineraries: FlightItinerary[] = raw.itineraries.map((itinerary) => {
    const segments: FlightItinerarySegment[] = itinerary.segments.map(
      (segment) => ({
        origin: segment.departure.iataCode,
        destination: segment.arrival.iataCode,
        departureAt: segment.departure.at,
        arrivalAt: segment.arrival.at,
        carrierCode: segment.carrierCode,
        flightNumber: segment.number,
        durationMinutes: parseIsoDurationToMinutes(segment.duration),
      }),
    );

    return {
      segments,
      durationMinutes: parseIsoDurationToMinutes(itinerary.duration),
      stops: segments.length - 1,
    };
  });

  const airlineCodes = raw.validatingAirlineCodes?.length
    ? raw.validatingAirlineCodes
    : Array.from(
        new Set(
          itineraries.flatMap((itinerary) =>
            itinerary.segments.map((s) => s.carrierCode),
          ),
        ),
      );

  const cabin =
    (raw.travelerPricings?.[0]?.fareDetailsBySegment?.[0]?.cabin as
      CabinClass | undefined) ?? requestedCabin;

  return {
    id: raw.id,
    itineraries,
    currency: raw.price.currency,
    totalPriceMinor: toMinorUnits(raw.price.total),
    basePriceMinor: toMinorUnits(raw.price.base),
    cabinClass: cabin,
    airlineCodes,
    // Conservative default — real refundability requires the Fare Rules
    // endpoint, not yet integrated.
    refundable: false,
  };
}
