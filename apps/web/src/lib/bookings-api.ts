import { request } from "./api-client";
import type { CabinClass, FlightOffer, TripType } from "./flight-types";

export type PassengerType = "ADULT" | "CHILD" | "INFANT";
export type DocumentType = "NATIONAL_ID" | "PASSPORT";
export type Gender = "MALE" | "FEMALE";
export type BookingStatus =
  | "PENDING"
  | "CONFIRMED"
  | "CANCELLED"
  | "COMPLETED"
  | "FAILED";
export type PaymentStatus = "PENDING" | "SUCCEEDED" | "FAILED" | "REFUNDED";

export interface PassengerInput {
  type: PassengerType;
  title: string;
  firstName: string;
  lastName: string;
  gender: Gender;
  dateOfBirth: string;
  nationality: string;
  documentType: DocumentType;
  documentNumber: string;
  documentExpiry: string;
  documentIssuingCountry: string;
  saveTraveler?: boolean;
}

export interface CreateFlightBookingInput {
  searchId: string;
  offerId: string;
  tripType: TripType;
  contactEmail: string;
  contactPhone: string;
  passengers: PassengerInput[];
}

export interface BookingPassenger {
  id: string;
  type: PassengerType;
  title: string;
  firstName: string;
  lastName: string;
  gender: Gender;
  dateOfBirth: string;
  nationality: string;
  documentType: DocumentType;
  documentNumber: string;
  documentExpiry: string;
  documentIssuingCountry: string;
}

export interface BookingPayment {
  id: string;
  status: PaymentStatus;
  chainId: number;
  tokenAddress: string;
  amountMinor: number;
  currency: string;
  escrowBookingIdHash: string;
  depositTxHash: string | null;
  releaseTxHash: string | null;
  refundTxHash: string | null;
}

export interface BookingRecord {
  id: string;
  userId: string;
  status: BookingStatus;
  currency: string;
  subtotalAmountMinor: number;
  taxAmountMinor: number;
  totalAmountMinor: number;
  createdAt: string;
  updatedAt: string;
  refunded: boolean;
  payment: BookingPayment | null;
  flightBooking: {
    id: string;
    tripType: TripType;
    cabinClass: CabinClass;
    offerSnapshot: FlightOffer;
    contactEmail: string;
    contactPhone: string;
    amadeusOrderId: string | null;
    pnr: string | null;
    passengers: BookingPassenger[];
  } | null;
}

export interface ListBookingsQuery {
  search?: string;
  status?: BookingStatus;
  page?: number;
  pageSize?: number;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

function toQueryString(params: object): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params as Record<string, unknown>)) {
    if (value !== undefined && value !== "") query.set(key, String(value));
  }
  const suffix = query.toString();
  return suffix ? `?${suffix}` : "";
}

export const bookingsApi = {
  createFlightBooking: (input: CreateFlightBookingInput) =>
    request<BookingRecord>("/bookings/flights", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  getById: (id: string) => request<BookingRecord>(`/bookings/${id}`),

  list: (params: ListBookingsQuery = {}) =>
    request<Paginated<BookingRecord>>(`/bookings${toQueryString(params)}`),
};
