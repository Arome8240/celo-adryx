"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AirlineLogo } from "@/components/flights/AirlineLogo";
import { DepositCard } from "@/components/payments/DepositCard";
import {
  bookingsApi,
  type BookingRecord,
  type BookingStatus,
} from "@/lib/bookings-api";
import {
  formatDurationMinutes,
  formatMoneyMinor,
  formatTime,
} from "@/lib/format-money";
import { useRequireAuth } from "@/lib/use-require-auth";

const STATUS_BADGE: Record<
  BookingStatus,
  "default" | "success" | "warning" | "error"
> = {
  PENDING: "warning",
  CONFIRMED: "success",
  COMPLETED: "success",
  CANCELLED: "default",
  FAILED: "error",
};

function celoscanTxUrl(hash: string): string {
  return `https://celoscan.io/tx/${hash}`;
}

export default function BookingDetailPage() {
  return (
    <Suspense fallback={null}>
      <BookingDetailContent />
    </Suspense>
  );
}

function BookingDetailContent() {
  const { ready, isSigningIn } = useRequireAuth();
  const params = useParams<{ id: string }>();
  const bookingId = decodeURIComponent(params.id);

  const [booking, setBooking] = useState<BookingRecord | null>(null);
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    if (!ready) return;
    bookingsApi
      .getById(bookingId)
      .then(setBooking)
      .catch((err) => setError(err instanceof Error ? err.message : "Booking not found"));
  }, [ready, bookingId]);

  if (!ready) {
    return (
      <main className="container max-w-lg py-8">
        <Card className="p-6">
          <p className="text-muted-foreground">
            {isSigningIn ? "Signing in…" : "Connect your wallet to view this booking."}
          </p>
        </Card>
      </main>
    );
  }

  return (
    <main className="container max-w-lg py-8">
      {error ? (
        <p className="rounded-lg border bg-card p-4 text-destructive">{error}</p>
      ) : !booking ? (
        <Skeleton className="h-48" />
      ) : (
        <>
          <div className="mb-6 flex items-center justify-between">
            <h1 className="text-2xl font-semibold">Flight booking</h1>
            <div className="flex items-center gap-2">
              {booking.refunded && <Badge variant="info">Refunded</Badge>}
              <Badge variant={STATUS_BADGE[booking.status]}>{booking.status}</Badge>
            </div>
          </div>

          <Card className="mb-5 p-5">
            {booking.flightBooking && (
              <>
                <div className="mb-4 flex items-center justify-between border-b pb-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Booking reference (PNR)</p>
                    <p className="font-mono text-lg font-bold">
                      {booking.flightBooking.pnr ?? "Pending"}
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {booking.flightBooking.tripType.replace("_", "-")} ·{" "}
                    {booking.flightBooking.cabinClass.replace("_", " ")}
                  </p>
                </div>

                {booking.flightBooking.offerSnapshot.itineraries.map(
                  (itinerary, itineraryIndex) => (
                    <div key={itineraryIndex} className="mb-4">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {itineraryIndex === 0 ? "Outbound" : "Return"}
                      </p>
                      {itinerary.segments.map((segment, segmentIndex) => (
                        <div
                          key={segmentIndex}
                          className={
                            "flex justify-between py-2 text-sm" +
                            (segmentIndex < itinerary.segments.length - 1
                              ? " border-b border-dashed"
                              : "")
                          }
                        >
                          <span className="flex items-center gap-2">
                            <AirlineLogo code={segment.carrierCode} size={16} />
                            {segment.carrierCode}
                            {segment.flightNumber} · {segment.origin}{" "}
                            {formatTime(segment.departureAt)} → {segment.destination}{" "}
                            {formatTime(segment.arrivalAt)}
                          </span>
                          <span className="text-muted-foreground">
                            {formatDurationMinutes(segment.durationMinutes)}
                          </span>
                        </div>
                      ))}
                    </div>
                  ),
                )}

                <div className="border-t pt-3">
                  {booking.flightBooking.passengers.map((passenger, index) => (
                    <p key={index}>
                      {passenger.title} {passenger.firstName} {passenger.lastName}{" "}
                      <span className="text-xs text-muted-foreground">
                        ({passenger.type})
                      </span>
                    </p>
                  ))}
                </div>
                <p className="mt-3 text-sm text-muted-foreground">
                  Contact: {booking.flightBooking.contactEmail}
                </p>
              </>
            )}

            <div className="mt-4 flex flex-col gap-1 border-t pt-3">
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Subtotal</span>
                <span>{formatMoneyMinor(booking.subtotalAmountMinor, booking.currency)}</span>
              </div>
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Tax</span>
                <span>{formatMoneyMinor(booking.taxAmountMinor, booking.currency)}</span>
              </div>
              <div className="mt-1 flex justify-between text-xl font-bold">
                <span>Total</span>
                <span>{formatMoneyMinor(booking.totalAmountMinor, booking.currency)}</span>
              </div>
            </div>
          </Card>

          {booking.payment && (
            <Card className="mb-5 p-5">
              <h3 className="mb-3 text-sm font-semibold">Payment</h3>
              <div className="flex justify-between py-1 text-sm">
                <span className="text-muted-foreground">Amount</span>
                <span>{formatMoneyMinor(booking.payment.amountMinor, booking.payment.currency)}</span>
              </div>
              <div className="flex justify-between py-1 text-sm">
                <span className="text-muted-foreground">Status</span>
                <span>{booking.payment.status}</span>
              </div>
              {booking.payment.depositTxHash && (
                <div className="flex justify-between py-1 text-sm">
                  <span className="text-muted-foreground">Deposit tx</span>
                  <a
                    href={celoscanTxUrl(booking.payment.depositTxHash)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline"
                  >
                    View on Celoscan
                  </a>
                </div>
              )}
              {booking.payment.releaseTxHash && (
                <div className="flex justify-between py-1 text-sm">
                  <span className="text-muted-foreground">Release tx</span>
                  <a
                    href={celoscanTxUrl(booking.payment.releaseTxHash)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline"
                  >
                    View on Celoscan
                  </a>
                </div>
              )}
              {booking.payment.refundTxHash && (
                <div className="flex justify-between py-1 text-sm">
                  <span className="text-muted-foreground">Refund tx</span>
                  <a
                    href={celoscanTxUrl(booking.payment.refundTxHash)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline"
                  >
                    View on Celoscan
                  </a>
                </div>
              )}
            </Card>
          )}

          {booking.status === "PENDING" && (!booking.payment || booking.payment.status !== "SUCCEEDED") && (
            <DepositCard booking={booking} onConfirmed={setBooking} />
          )}
        </>
      )}
    </main>
  );
}
