import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { normalizePhoneNumber, splitPhoneNumber } from '../common/lib/phone';
import { FlightsService } from '../flights/flights.service';
import { normalizeAmadeusOffer } from '../flights/lib/normalize-amadeus-offer';
import type { AmadeusOrderTravelerInput } from '../flights/providers/amadeus-flight.provider';
import { AmadeusFlightProvider } from '../flights/providers/amadeus-flight.provider';
import { PrismaService } from '../prisma/prisma.service';
import type { Prisma } from '../../generated/prisma/client';
import { CreateFlightBookingDto } from './dto/create-flight-booking.dto';
import { ListBookingsQueryDto } from './dto/list-bookings-query.dto';

const BOOKING_INCLUDE = {
  flightBooking: { include: { passengers: true } },
  payment: true,
} satisfies Prisma.BookingInclude;

@Injectable()
export class BookingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly flightsService: FlightsService,
    private readonly amadeusFlightProvider: AmadeusFlightProvider,
  ) {}

  async createFlightBooking(userId: string, dto: CreateFlightBookingDto) {
    const offer = this.flightsService.getOfferFromCache(
      dto.searchId,
      dto.offerId,
    );
    const rawOffer = this.flightsService.getRawOfferFromCache(
      dto.searchId,
      dto.offerId,
    );
    if (!offer || !rawOffer) {
      throw new NotFoundException(
        'That flight offer has expired — please search again',
      );
    }

    const adults = dto.passengers.filter((p) => p.type === 'ADULT').length;
    const infants = dto.passengers.filter((p) => p.type === 'INFANT').length;
    if (adults === 0) {
      throw new BadRequestException('At least one adult passenger is required');
    }
    if (infants > adults) {
      throw new BadRequestException('Infants cannot outnumber adults');
    }

    // Route-aware ID requirement: national ID is fine for a domestic
    // itinerary, but a passport is required the moment any segment crosses
    // a border — never a blanket "passport for everyone" rule.
    const domestic = await this.flightsService.isDomesticOffer(offer);
    if (!domestic) {
      const missingPassport = dto.passengers.find(
        (p) => p.documentType !== 'PASSPORT',
      );
      if (missingPassport) {
        throw new BadRequestException(
          `${missingPassport.firstName} ${missingPassport.lastName} needs a passport for this international itinerary`,
        );
      }
    }

    const phoneParts = splitPhoneNumber(dto.contactPhone);
    if (!phoneParts) {
      throw new BadRequestException('Invalid contact phone number');
    }

    // Nationality/issuing-country are already 2-letter codes by the time
    // they reach here — the frontend enforces that, so the backend just
    // passes them through rather than re-deriving/converting them.
    const travelers: AmadeusOrderTravelerInput[] = dto.passengers.map(
      (passenger) => ({
        dateOfBirth: passenger.dateOfBirth,
        gender: passenger.gender,
        firstName: passenger.firstName,
        lastName: passenger.lastName,
        email: dto.contactEmail,
        phoneCountryCallingCode: phoneParts.countryCallingCode,
        phoneNumber: phoneParts.number,
        documentType:
          passenger.documentType === 'PASSPORT' ? 'PASSPORT' : 'IDENTITY_CARD',
        documentNumber: passenger.documentNumber,
        documentExpiryDate: passenger.documentExpiry,
        documentIssuanceCountry: passenger.documentIssuingCountry,
        nationality: passenger.nationality,
      }),
    );

    // The real Amadeus reservation is made right here, before any local row
    // exists or any payment happens — a customer who reaches "Confirm
    // booking" has an actual PNR, not just a pending record we hope to
    // honor later. Amadeus requires a freshly-priced offer (not a stale
    // search result) as input, so price first; the priced offer's confirmed
    // total is what we actually charge, in case it drifted from the cached
    // search price.
    const pricedRawOffer =
      await this.amadeusFlightProvider.priceOffer(rawOffer);
    const pricedOffer = normalizeAmadeusOffer(pricedRawOffer, offer.cabinClass);
    const order = await this.amadeusFlightProvider.createOrder(
      pricedRawOffer,
      travelers,
    );

    // No tax/discount layer yet — subtotal and total are the same until a
    // jurisdiction-aware tax model is actually needed (there's no single
    // "home country" to apply a VAT rate against here the way adryxflight
    // applies Nigerian VAT).
    const totalAmountMinor = pricedOffer.totalPriceMinor;

    const booking = await this.prisma.$transaction(async (tx) => {
      const created = await tx.booking.create({
        data: {
          userId,
          status: 'PENDING',
          currency: pricedOffer.currency,
          subtotalAmountMinor: totalAmountMinor,
          taxAmountMinor: 0,
          totalAmountMinor,
        },
      });

      const flightBooking = await tx.flightBooking.create({
        data: {
          bookingId: created.id,
          tripType: dto.tripType,
          cabinClass: pricedOffer.cabinClass,
          offerSnapshot: pricedOffer as unknown as Prisma.InputJsonValue,
          contactEmail: dto.contactEmail,
          contactPhone:
            normalizePhoneNumber(dto.contactPhone) ?? dto.contactPhone,
          amadeusOrderId: order.orderId,
          pnr: order.pnr,
        },
      });

      await tx.passenger.createMany({
        data: dto.passengers.map((passenger) => ({
          flightBookingId: flightBooking.id,
          type: passenger.type,
          title: passenger.title,
          firstName: passenger.firstName,
          lastName: passenger.lastName,
          gender: passenger.gender,
          dateOfBirth: new Date(passenger.dateOfBirth),
          nationality: passenger.nationality,
          documentType: passenger.documentType,
          documentNumber: passenger.documentNumber,
          documentExpiry: new Date(passenger.documentExpiry),
          documentIssuingCountry: passenger.documentIssuingCountry,
        })),
      });

      return created;
    });

    await this.saveMarkedTravelers(userId, dto.passengers);

    return this.getById(booking.id, userId);
  }

  async getById(id: string, userId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: BOOKING_INCLUDE,
    });
    if (!booking || booking.userId !== userId) {
      throw new NotFoundException('Booking not found');
    }
    return this.enrichBooking(booking);
  }

  /** Server-side search + pagination — never client-side-only over an already-loaded page. */
  async list(userId: string, query: ListBookingsQueryDto) {
    const search = query.search?.trim();

    const where: Prisma.BookingWhereInput = {
      userId,
      ...(query.status ? { status: query.status } : {}),
      ...(search
        ? {
            OR: [
              {
                flightBooking: {
                  contactEmail: { contains: search, mode: 'insensitive' },
                },
              },
              {
                flightBooking: {
                  contactPhone: { contains: search, mode: 'insensitive' },
                },
              },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.booking.findMany({
        where,
        include: BOOKING_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.booking.count({ where }),
    ]);

    return {
      items: items.map((item) => this.enrichBooking(item)),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  /** Attaches a simple refund flag from payment history — computed here once rather than duplicated on the frontend. */
  private enrichBooking<T extends { payment: { status: string } | null }>(
    booking: T,
  ) {
    return { ...booking, refunded: booking.payment?.status === 'REFUNDED' };
  }

  private async saveMarkedTravelers(
    userId: string,
    passengers: CreateFlightBookingDto['passengers'],
  ): Promise<void> {
    const toSave = passengers.filter((passenger) => passenger.saveTraveler);
    for (const passenger of toSave) {
      await this.prisma.savedTraveler.create({
        data: {
          userId,
          title: passenger.title,
          firstName: passenger.firstName,
          lastName: passenger.lastName,
          dateOfBirth: new Date(passenger.dateOfBirth),
          nationality: passenger.nationality,
          documentType: passenger.documentType,
          documentNumber: passenger.documentNumber,
          documentExpiry: new Date(passenger.documentExpiry),
          documentIssuingCountry: passenger.documentIssuingCountry,
        },
      });
    }
  }
}
