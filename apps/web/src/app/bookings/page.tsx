"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AirlineLogo } from "@/components/flights/AirlineLogo";
import { bookingsApi, type BookingRecord, type BookingStatus } from "@/lib/bookings-api";
import { formatMoneyMinor } from "@/lib/format-money";
import { useRequireAuth } from "@/lib/use-require-auth";

const STATUS_BADGE: Record<BookingStatus, "default" | "success" | "warning" | "error"> = {
  PENDING: "warning",
  CONFIRMED: "success",
  COMPLETED: "success",
  CANCELLED: "default",
  FAILED: "error",
};

export default function BookingsListPage() {
  const { ready, isSigningIn } = useRequireAuth();
  const [bookings, setBookings] = useState<BookingRecord[] | null>(null);
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    if (!ready) return;
    bookingsApi
      .list({ pageSize: 50 })
      .then((result) => setBookings(result.items))
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load bookings"));
  }, [ready]);

  if (!ready) {
    return (
      <main className="container max-w-lg py-8">
        <Card className="p-6">
          <p className="text-muted-foreground">
            {isSigningIn ? "Signing in…" : "Connect your wallet to see your trips."}
          </p>
        </Card>
      </main>
    );
  }

  return (
    <main className="container max-w-lg py-8">
      <h1 className="mb-6 text-2xl font-semibold">My trips</h1>

      {error ? (
        <p className="rounded-lg border bg-card p-4 text-destructive">{error}</p>
      ) : !bookings ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
      ) : bookings.length === 0 ? (
        <Card className="p-6 text-center">
          <p className="mb-3 text-muted-foreground">No trips yet.</p>
          <Link href="/" className="text-primary underline">
            Search for a flight
          </Link>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {bookings.map((booking) => {
            const firstSegment = booking.flightBooking?.offerSnapshot.itineraries[0]?.segments[0];
            const lastSegment =
              booking.flightBooking?.offerSnapshot.itineraries[0]?.segments.slice(-1)[0];
            return (
              <Link key={booking.id} href={`/bookings/${booking.id}`}>
                <Card className="p-4 transition-colors hover:border-primary/50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {booking.flightBooking && (
                        <AirlineLogo
                          code={booking.flightBooking.offerSnapshot.airlineCodes[0]}
                          size={20}
                        />
                      )}
                      <div>
                        <p className="font-medium">
                          {firstSegment?.origin ?? "?"} → {lastSegment?.destination ?? "?"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          PNR: {booking.flightBooking?.pnr ?? "Pending"}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">
                        {formatMoneyMinor(booking.totalAmountMinor, booking.currency)}
                      </p>
                      <Badge variant={STATUS_BADGE[booking.status]}>{booking.status}</Badge>
                    </div>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}
