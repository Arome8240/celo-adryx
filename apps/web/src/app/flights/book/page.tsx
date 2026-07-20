"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { AirlineLogo } from "@/components/flights/AirlineLogo";
import { PassengerFields } from "@/components/flights/PassengerFields";
import { DepositCard } from "@/components/payments/DepositCard";
import { useAuthStore } from "@/lib/auth-store";
import {
  bookingsApi,
  type BookingRecord,
  type PassengerInput,
} from "@/lib/bookings-api";
import { flightsApi } from "@/lib/flights-api";
import type { FlightOffer, TripType } from "@/lib/flight-types";
import { formatMoneyMinor } from "@/lib/format-money";
import { travelersApi, type SavedTraveler } from "@/lib/travelers-api";
import { useRequireAuth } from "@/lib/use-require-auth";

function emptyPassenger(type: PassengerInput["type"]): PassengerInput {
  return {
    type,
    title: "Mr",
    firstName: "",
    lastName: "",
    gender: "MALE",
    dateOfBirth: "",
    nationality: "",
    documentType: "NATIONAL_ID",
    documentNumber: "",
    documentExpiry: "",
    documentIssuingCountry: "",
  };
}

export default function FlightBookingPage() {
  return (
    <Suspense fallback={null}>
      <FlightBookingForm />
    </Suspense>
  );
}

function FlightBookingForm() {
  const { ready, isSigningIn } = useRequireAuth();
  const searchParams = useSearchParams();
  const user = useAuthStore((state) => state.user);

  const searchId = searchParams.get("searchId") ?? "";
  const offerId = searchParams.get("offerId") ?? "";
  const tripType = (searchParams.get("tripType") as TripType) ?? "ONE_WAY";
  const adults = Number(searchParams.get("adults") ?? 1);
  const childrenCount = Number(searchParams.get("children") ?? 0);
  const infants = Number(searchParams.get("infants") ?? 0);

  const [offer, setOffer] = useState<FlightOffer | null>(null);
  const [offerError, setOfferError] = useState<string | undefined>();
  const [savedTravelers, setSavedTravelers] = useState<SavedTraveler[]>([]);

  const initialPassengers = useMemo(() => {
    const list: PassengerInput[] = [];
    for (let i = 0; i < adults; i++) list.push(emptyPassenger("ADULT"));
    for (let i = 0; i < childrenCount; i++) list.push(emptyPassenger("CHILD"));
    for (let i = 0; i < infants; i++) list.push(emptyPassenger("INFANT"));
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [passengers, setPassengers] = useState<PassengerInput[]>(initialPassengers);

  const [contactEmail, setContactEmail] = useState(user?.email ?? "");
  const [contactPhone, setContactPhone] = useState(user?.phone ?? "");
  const [error, setError] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [confirmed, setConfirmed] = useState<BookingRecord | undefined>();

  useEffect(() => {
    if (!searchId || !offerId) return;
    flightsApi
      .getResults(searchId, {})
      .then((result) => {
        const found = result.offers.find((o) => o.id === offerId);
        if (!found) {
          setOfferError("This offer has expired — please search again.");
        } else {
          setOffer(found);
        }
      })
      .catch(() => setOfferError("This offer has expired — please search again."));
  }, [searchId, offerId]);

  useEffect(() => {
    if (!ready) return;
    travelersApi
      .list()
      .then(setSavedTravelers)
      .catch(() => setSavedTravelers([]));
  }, [ready]);

  function updatePassenger(index: number, patch: Partial<PassengerInput>) {
    setPassengers((current) =>
      current.map((p, i) => (i === index ? { ...p, ...patch } : p)),
    );
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(undefined);
    setLoading(true);
    try {
      const booking = await bookingsApi.createFlightBooking({
        searchId,
        offerId,
        tripType,
        contactEmail,
        contactPhone,
        passengers,
      });
      setConfirmed(booking);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Booking failed");
    } finally {
      setLoading(false);
    }
  }

  if (!ready) {
    return (
      <main className="container max-w-lg py-8">
        <Card className="p-6">
          <p className="text-muted-foreground">
            {isSigningIn ? "Signing in…" : "Connect your wallet to book this flight."}
          </p>
        </Card>
      </main>
    );
  }

  if (!searchId || !offerId) {
    return (
      <main className="container max-w-lg py-8">
        <p className="rounded-lg border bg-card p-4 text-destructive">
          Missing flight selection — please search again.
        </p>
      </main>
    );
  }

  if (confirmed) {
    return (
      <main className="container max-w-lg py-8">
        <Card className="p-6">
          <h1 className="text-xl font-semibold">Booking created</h1>
          <p className="mt-3 text-muted-foreground">
            Booking reference (PNR):{" "}
            <strong>{confirmed.flightBooking?.pnr ?? "Pending"}</strong>
          </p>
          <Link href={`/bookings/${confirmed.id}`} className="mt-3 inline-block text-primary">
            View booking details →
          </Link>
        </Card>
        <div className="mt-6">
          <DepositCard booking={confirmed} onConfirmed={setConfirmed} />
        </div>
      </main>
    );
  }

  return (
    <main className="container max-w-lg py-8">
      <h1 className="mb-6 text-2xl font-semibold">Passenger details</h1>

      {offerError ? (
        <p className="rounded-lg border bg-card p-4 text-destructive">{offerError}</p>
      ) : (
        <>
          {offer && (
            <Card className="mb-6 p-5">
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  {offer.airlineCodes.map((code) => (
                    <AirlineLogo key={code} code={code} size={16} />
                  ))}
                </span>
                {offer.airlineCodes.join(" · ")} · {offer.cabinClass.replace("_", " ")}
              </p>
              <p className="mt-1 text-xl font-bold">
                {formatMoneyMinor(offer.totalPriceMinor, offer.currency)}
              </p>
            </Card>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <Card className="p-5">
              <h3 className="mb-4 font-semibold">Contact details</h3>
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Email"
                  type="email"
                  required
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                />
                <Input
                  label="Phone (with country code)"
                  type="tel"
                  placeholder="+14155550100"
                  required
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                />
              </div>
            </Card>

            {passengers.map((passenger, index) => (
              <PassengerFields
                key={index}
                label={`${passenger.type.charAt(0)}${passenger.type.slice(1).toLowerCase()} ${
                  passengers.slice(0, index + 1).filter((p) => p.type === passenger.type).length
                }`}
                passenger={passenger}
                onChange={(patch) => updatePassenger(index, patch)}
                savedTravelers={savedTravelers}
              />
            ))}

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "Confirming…" : "Confirm booking"}
            </Button>
          </form>
        </>
      )}
    </main>
  );
}
