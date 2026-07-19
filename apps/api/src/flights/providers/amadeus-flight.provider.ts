import { Injectable, InternalServerErrorException } from '@nestjs/common';
import type Amadeus from 'amadeus';
import { amadeusErrorMessage } from '../lib/amadeus-error';
import type { AmadeusOfferRaw } from '../lib/normalize-amadeus-offer';
import type { FlightSearchParams } from '../types/flight.types';
import { AmadeusAuthService } from './amadeus-auth.service';

interface AmadeusTraveler {
  id: string;
  travelerType: 'ADULT' | 'CHILD' | 'HELD_INFANT';
}

export interface AmadeusOrderTravelerInput {
  dateOfBirth: string;
  gender: 'MALE' | 'FEMALE';
  firstName: string;
  lastName: string;
  email: string;
  phoneCountryCallingCode: string;
  phoneNumber: string;
  documentType: 'PASSPORT' | 'IDENTITY_CARD';
  documentNumber: string;
  documentExpiryDate?: string;
  /** ISO 3166-1 alpha-2. */
  documentIssuanceCountry: string;
  /** ISO 3166-1 alpha-2. */
  nationality: string;
}

export interface AmadeusOrderResult {
  orderId: string;
  pnr: string | null;
}

function buildTravelers(params: FlightSearchParams): AmadeusTraveler[] {
  const travelers: AmadeusTraveler[] = [];
  let id = 1;
  for (let i = 0; i < params.adults; i++)
    travelers.push({ id: String(id++), travelerType: 'ADULT' });
  for (let i = 0; i < params.children; i++)
    travelers.push({ id: String(id++), travelerType: 'CHILD' });
  for (let i = 0; i < params.infants; i++)
    travelers.push({ id: String(id++), travelerType: 'HELD_INFANT' });
  return travelers;
}

/**
 * Real Amadeus Self-Service Flight Offers Search integration — the single
 * flight provider this app uses. Uses the official `amadeus` npm SDK so
 * token acquisition/caching/refresh is the SDK's problem, not this file's.
 */
@Injectable()
export class AmadeusFlightProvider {
  constructor(private readonly auth: AmadeusAuthService) {}

  async search(params: FlightSearchParams): Promise<AmadeusOfferRaw[]> {
    const amadeus = this.auth.getClient();
    return params.tripType === 'MULTI_CITY'
      ? this.searchMultiCity(amadeus, params)
      : this.searchSimple(amadeus, params);
  }

  private async searchSimple(
    amadeus: Amadeus,
    params: FlightSearchParams,
  ): Promise<AmadeusOfferRaw[]> {
    const [outbound, inbound] = params.segments;
    const query: Record<string, string> = {
      originLocationCode: outbound.origin,
      destinationLocationCode: outbound.destination,
      departureDate: outbound.departureDate,
      adults: String(params.adults),
      travelClass: params.cabinClass,
      currencyCode: 'USD',
      max: '50',
    };
    if (params.children > 0) query.children = String(params.children);
    if (params.infants > 0) query.infants = String(params.infants);
    if (params.tripType === 'ROUND_TRIP' && inbound) {
      query.returnDate = inbound.departureDate;
    }

    try {
      const response = await amadeus.shopping.flightOffersSearch.get(query);
      return (response.data ?? []) as AmadeusOfferRaw[];
    } catch (err) {
      throw new InternalServerErrorException(
        `Amadeus search failed: ${amadeusErrorMessage(err)}`,
      );
    }
  }

  private async searchMultiCity(
    amadeus: Amadeus,
    params: FlightSearchParams,
  ): Promise<AmadeusOfferRaw[]> {
    const originDestinationIds = params.segments.map((_, index) =>
      String(index + 1),
    );

    const requestBody = {
      currencyCode: 'USD',
      originDestinations: params.segments.map((segment, index) => ({
        id: String(index + 1),
        originLocationCode: segment.origin,
        destinationLocationCode: segment.destination,
        departureDateTimeRange: { date: segment.departureDate },
      })),
      travelers: buildTravelers(params),
      sources: ['GDS'],
      searchCriteria: {
        maxFlightOffers: 50,
        flightFilters: {
          cabinRestrictions: [
            { cabin: params.cabinClass, originDestinationIds },
          ],
        },
      },
    };

    try {
      const response =
        await amadeus.shopping.flightOffersSearch.post(requestBody);
      return (response.data ?? []) as AmadeusOfferRaw[];
    } catch (err) {
      throw new InternalServerErrorException(
        `Amadeus search failed: ${amadeusErrorMessage(err)}`,
      );
    }
  }

  /** Confirms current price/availability for one specific offer — Amadeus requires a freshly-priced offer (not a stale search result) as input to Flight Create Orders. */
  async priceOffer(rawOffer: AmadeusOfferRaw): Promise<AmadeusOfferRaw> {
    const amadeus = this.auth.getClient();
    try {
      const response = await amadeus.shopping.flightOffers.pricing.post({
        data: { type: 'flight-offers-pricing', flightOffers: [rawOffer] },
      });
      const priced = response.data?.flightOffers?.[0];
      if (!priced) {
        throw new InternalServerErrorException(
          'Amadeus returned no priced offer',
        );
      }
      return priced as AmadeusOfferRaw;
    } catch (err) {
      throw new InternalServerErrorException(
        `Amadeus pricing failed: ${amadeusErrorMessage(err)}`,
      );
    }
  }

  /**
   * Creates the real Amadeus flight order (PNR) — called at booking-creation
   * time (before payment), not after, so a customer who completes "Confirm
   * booking" has an actual reservation, not just a local pending row.
   */
  async createOrder(
    pricedOffer: AmadeusOfferRaw,
    travelers: AmadeusOrderTravelerInput[],
  ): Promise<AmadeusOrderResult> {
    const amadeus = this.auth.getClient();
    const travelerIds = (pricedOffer.travelerPricings ?? []).map(
      (pricing, index) => pricing.travelerId ?? String(index + 1),
    );

    try {
      const response = await amadeus.booking.flightOrders.post({
        data: {
          type: 'flight-order',
          flightOffers: [pricedOffer],
          travelers: travelers.map((traveler, index) => ({
            id: travelerIds[index] ?? String(index + 1),
            dateOfBirth: traveler.dateOfBirth,
            gender: traveler.gender,
            name: {
              firstName: traveler.firstName,
              lastName: traveler.lastName,
            },
            contact: {
              emailAddress: traveler.email,
              phones: [
                {
                  deviceType: 'MOBILE',
                  countryCallingCode: traveler.phoneCountryCallingCode,
                  number: traveler.phoneNumber,
                },
              ],
            },
            documents: [
              {
                documentType: traveler.documentType,
                number: traveler.documentNumber,
                expiryDate: traveler.documentExpiryDate,
                issuanceCountry: traveler.documentIssuanceCountry,
                nationality: traveler.nationality,
                holder: true,
              },
            ],
          })),
        },
      });

      const data = response.data;
      if (!data) {
        throw new InternalServerErrorException(
          'Amadeus returned no order data',
        );
      }
      return {
        orderId: data.id,
        pnr: data.associatedRecords?.[0]?.reference ?? null,
      };
    } catch (err) {
      throw new InternalServerErrorException(
        `Amadeus order creation failed: ${amadeusErrorMessage(err)}`,
      );
    }
  }
}
