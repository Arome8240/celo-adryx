"use client";

import { useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import type { FlightOffer, TripType } from "@/lib/flight-types";
import { formatDurationMinutes, formatMoneyMinor, formatTime } from "@/lib/format-money";
import { AirlineLogo } from "./AirlineLogo";

export interface FlightResultCardProps {
  offer: FlightOffer;
  searchId: string;
  tripType: TripType;
  adults: number;
  /** Named childrenCount, not children — React reserves the `children` prop name. */
  childrenCount: number;
  infants: number;
}

export function FlightResultCard({
  offer,
  searchId,
  tripType,
  adults,
  childrenCount,
  infants,
}: FlightResultCardProps) {
  const [expanded, setExpanded] = useState(false);
  const outbound = offer.itineraries[0];
  const inbound = offer.itineraries[1];

  const bookHref = `/flights/book?${new URLSearchParams({
    searchId,
    offerId: offer.id,
    tripType,
    adults: String(adults),
    children: String(childrenCount),
    infants: String(infants),
  }).toString()}`;

  return (
    <Card
      className="cursor-pointer p-5 transition-colors hover:border-primary/50"
      onClick={() => setExpanded((current) => !current)}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex-1">
          <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              {offer.airlineCodes.map((code) => (
                <AirlineLogo key={code} code={code} size={16} />
              ))}
            </span>
            <span>
              {offer.airlineCodes.join(" · ")} · {offer.cabinClass.replace("_", " ")}
            </span>
          </div>
          <ItineraryRow itinerary={outbound} />
          {inbound && (
            <div className="mt-3">
              <ItineraryRow itinerary={inbound} />
            </div>
          )}
        </div>

        <div className="text-right">
          <div className="text-2xl font-bold text-foreground">
            {formatMoneyMinor(offer.totalPriceMinor, offer.currency)}
          </div>
          <div className="mb-3 text-xs text-muted-foreground">total price</div>
          <Link
            href={bookHref}
            onClick={(event) => event.stopPropagation()}
            className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Book
          </Link>
        </div>
      </div>

      {expanded && (
        <div className="mt-5 border-t pt-4">
          {offer.itineraries.map((itinerary, itineraryIndex) => (
            <div key={itineraryIndex} className="mb-4">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {itineraryIndex === 0 ? "Outbound" : "Return"}
              </div>
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
          ))}
          <p className="text-xs text-muted-foreground">
            Fare rules and refund conditions are confirmed at checkout.
          </p>
        </div>
      )}
    </Card>
  );
}

function ItineraryRow({ itinerary }: { itinerary: FlightOffer["itineraries"][number] }) {
  const first = itinerary.segments[0];
  const last = itinerary.segments[itinerary.segments.length - 1];
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="font-semibold">{formatTime(first.departureAt)}</span>
      <span className="text-muted-foreground">{first.origin}</span>
      <span className="text-muted-foreground">
        —— {formatDurationMinutes(itinerary.durationMinutes)} ——
      </span>
      <span className="text-muted-foreground">{last.destination}</span>
      <span className="font-semibold">{formatTime(last.arrivalAt)}</span>
      <span className="text-xs text-muted-foreground">
        {itinerary.stops === 0 ? "Direct" : `${itinerary.stops} stop${itinerary.stops > 1 ? "s" : ""}`}
      </span>
    </div>
  );
}
