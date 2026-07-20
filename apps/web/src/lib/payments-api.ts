import { request } from "./api-client";
import type { BookingRecord } from "./bookings-api";

export type PaymentAsset = "USDM" | "CELO";

export interface InitiatePaymentResult {
  contractAddress: string;
  /** Null for the native-CELO path — there's no ERC20 token to approve. */
  tokenAddress: string | null;
  /** The asset's smallest-unit amount (18 decimals), as a decimal string. */
  amount: string;
  bookingIdHash: string;
  isNative: boolean;
}

export const paymentsApi = {
  initiate: (bookingId: string, asset: PaymentAsset) =>
    request<InitiatePaymentResult>(`/payments/bookings/${bookingId}/initiate`, {
      method: "POST",
      body: JSON.stringify({ asset }),
    }),

  confirm: (bookingId: string, txHash: string) =>
    request<BookingRecord>(`/payments/bookings/${bookingId}/confirm`, {
      method: "POST",
      body: JSON.stringify({ txHash }),
    }),
};
