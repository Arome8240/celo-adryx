import { request } from "./api-client";

export interface InitiatePaymentResult {
  contractAddress: string;
  tokenAddress: string;
  /** The token's smallest-unit amount (18 decimals), as a decimal string. */
  amount: string;
  bookingIdHash: string;
}

export const paymentsApi = {
  initiate: (bookingId: string) =>
    request<InitiatePaymentResult>(`/payments/bookings/${bookingId}/initiate`, {
      method: "POST",
    }),

  confirm: (bookingId: string, txHash: string) =>
    request(`/payments/bookings/${bookingId}/confirm`, {
      method: "POST",
      body: JSON.stringify({ txHash }),
    }),
};
