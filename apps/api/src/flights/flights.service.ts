import { randomUUID } from 'crypto';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { FlightSearchFiltersDto } from './dto/flight-search-filters.dto';
import type { SearchFlightsDto } from './dto/search-flights.dto';
import type { AmadeusOfferRaw } from './lib/normalize-amadeus-offer';
import { normalizeAmadeusOffer } from './lib/normalize-amadeus-offer';
import { AmadeusFlightProvider } from './providers/amadeus-flight.provider';
import type {
  AirportSummary,
  FlightOffer,
  FlightSearchResponse,
} from './types/flight.types';

interface CachedSearch {
  offers: FlightOffer[];
  /** The exact Amadeus offer objects search returned — required (unmodified)
   * input to Flight Offers Price / Flight Create Orders later; our own
   * normalized `FlightOffer` type deliberately drops everything Amadeus
   * needs for that. */
  rawOffers: AmadeusOfferRaw[];
  expiresAt: number;
  tripType: SearchFlightsDto['tripType'];
  adults: number;
  children: number;
  infants: number;
}

const CACHE_TTL_MS = 15 * 60 * 1000;

function totalDurationMinutes(offer: FlightOffer): number {
  return offer.itineraries.reduce(
    (sum, itinerary) => sum + itinerary.durationMinutes,
    0,
  );
}

function maxStops(offer: FlightOffer): number {
  return Math.max(0, ...offer.itineraries.map((itinerary) => itinerary.stops));
}

/**
 * Server-driven filter/sort over a cached result set. The cache is
 * in-memory (single-process, short TTL) — a deliberate simplification;
 * move to Redis if this ever needs to run horizontally scaled.
 */
@Injectable()
export class FlightsService {
  private readonly cache = new Map<string, CachedSearch>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly amadeus: AmadeusFlightProvider,
  ) {}

  async search(dto: SearchFlightsDto): Promise<FlightSearchResponse> {
    if (dto.infants > dto.adults) {
      throw new BadRequestException('Infants cannot outnumber adults');
    }
    if (dto.tripType === 'ROUND_TRIP' && dto.segments.length < 2) {
      throw new BadRequestException(
        'Round-trip search requires a return segment',
      );
    }
    if (dto.tripType === 'MULTI_CITY' && dto.segments.length < 2) {
      throw new BadRequestException(
        'Multi-city search requires at least 2 segments',
      );
    }

    const rawOffers = await this.amadeus.search(dto);
    const offers = rawOffers.map((raw) =>
      normalizeAmadeusOffer(raw, dto.cabinClass),
    );

    const searchId = randomUUID();
    const expiresAt = Date.now() + CACHE_TTL_MS;
    const cached: CachedSearch = {
      offers,
      rawOffers,
      expiresAt,
      tripType: dto.tripType,
      adults: dto.adults,
      children: dto.children,
      infants: dto.infants,
    };
    this.cache.set(searchId, cached);
    this.evictExpired();

    return this.buildResponse(searchId, cached, {});
  }

  getResults(
    searchId: string,
    filters: FlightSearchFiltersDto,
  ): FlightSearchResponse {
    const cached = this.cache.get(searchId);
    if (!cached || cached.expiresAt < Date.now()) {
      throw new NotFoundException(
        'Search results have expired — please search again',
      );
    }
    return this.buildResponse(searchId, cached, filters);
  }

  /** Re-fetches a specific offer from an active cached search — used by BookingsService to re-verify a priced offer before creating a booking. */
  getOfferFromCache(searchId: string, offerId: string): FlightOffer | null {
    const cached = this.cache.get(searchId);
    if (!cached || cached.expiresAt < Date.now()) return null;
    return cached.offers.find((offer) => offer.id === offerId) ?? null;
  }

  /** The exact raw Amadeus offer object behind a cached normalized offer — needed to call Flight Offers Price / Flight Create Orders, which require Amadeus's own unmodified offer shape. */
  getRawOfferFromCache(
    searchId: string,
    offerId: string,
  ): AmadeusOfferRaw | null {
    const cached = this.cache.get(searchId);
    if (!cached || cached.expiresAt < Date.now()) return null;
    return cached.rawOffers.find((offer) => offer.id === offerId) ?? null;
  }

  /**
   * True only if every segment of every itinerary stays within a single
   * country — the route-aware ID-requirement check (national ID is fine
   * domestically; a passport is required the moment any segment crosses a
   * border). Country-agnostic by design — this app has no single "home
   * country" the way adryxflight has Nigeria.
   */
  async isDomesticOffer(offer: FlightOffer): Promise<boolean> {
    const codes = Array.from(
      new Set(
        offer.itineraries.flatMap((itinerary) =>
          itinerary.segments.flatMap((s) => [s.origin, s.destination]),
        ),
      ),
    );
    const airports = await this.prisma.airport.findMany({
      where: { iataCode: { in: codes } },
      select: { iataCode: true, countryCode: true },
    });
    if (airports.length !== codes.length) return false;
    const countryCodes = new Set(airports.map((airport) => airport.countryCode));
    return countryCodes.size === 1;
  }

  async searchAirports(query: string): Promise<AirportSummary[]> {
    const trimmed = query?.trim() ?? '';
    if (trimmed.length < 2) return [];

    const results = await this.prisma.airport.findMany({
      where: {
        OR: [
          { iataCode: { equals: trimmed.toUpperCase() } },
          { city: { contains: trimmed, mode: 'insensitive' } },
          { name: { contains: trimmed, mode: 'insensitive' } },
        ],
      },
      orderBy: { city: 'asc' },
      take: 10,
    });

    return results.map((airport) => ({
      iataCode: airport.iataCode,
      name: airport.name,
      city: airport.city,
      country: airport.country,
      countryCode: airport.countryCode,
    }));
  }

  private buildResponse(
    searchId: string,
    cached: CachedSearch,
    filters: Partial<FlightSearchFiltersDto>,
  ): FlightSearchResponse {
    const { offers, expiresAt } = cached;
    let filtered = offers;

    if (filters.maxStops !== undefined) {
      const cap = filters.maxStops;
      filtered = filtered.filter((offer) => maxStops(offer) <= cap);
    }
    if (filters.minPriceMinor !== undefined) {
      const min = filters.minPriceMinor;
      filtered = filtered.filter((offer) => offer.totalPriceMinor >= min);
    }
    if (filters.maxPriceMinor !== undefined) {
      const max = filters.maxPriceMinor;
      filtered = filtered.filter((offer) => offer.totalPriceMinor <= max);
    }
    if (filters.airlineCodes) {
      const wanted = filters.airlineCodes.split(',').filter(Boolean);
      if (wanted.length > 0) {
        filtered = filtered.filter((offer) =>
          offer.airlineCodes.some((code) => wanted.includes(code)),
        );
      }
    }

    const sorted = [...filtered].sort((a, b) =>
      filters.sort === 'duration'
        ? totalDurationMinutes(a) - totalDurationMinutes(b)
        : a.totalPriceMinor - b.totalPriceMinor,
    );

    const availableAirlineCodes = Array.from(
      new Set(offers.flatMap((offer) => offer.airlineCodes)),
    ).sort();

    return {
      searchId,
      offers: sorted,
      totalCount: offers.length,
      filteredCount: sorted.length,
      availableAirlineCodes,
      expiresAt: new Date(expiresAt).toISOString(),
      tripType: cached.tripType,
      adults: cached.adults,
      children: cached.children,
      infants: cached.infants,
    };
  }

  private evictExpired(): void {
    const now = Date.now();
    for (const [id, entry] of this.cache) {
      if (entry.expiresAt < now) this.cache.delete(id);
    }
  }
}
