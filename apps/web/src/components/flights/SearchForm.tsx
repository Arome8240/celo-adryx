"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SearchNormal } from "iconsax-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import type { AirportSummary, CabinClass, TripType } from "@/lib/flight-types";
import { AirportAutocomplete } from "./AirportAutocomplete";
import { DatePickerField } from "./DatePickerField";

function todayDateString(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

interface FlightSegmentState {
  origin: string;
  originLabel: string;
  destination: string;
  destinationLabel: string;
  date: string;
}

const TRIP_TYPES: { value: TripType; label: string }[] = [
  { value: "ONE_WAY", label: "One-way" },
  { value: "ROUND_TRIP", label: "Round-trip" },
  { value: "MULTI_CITY", label: "Multi-city" },
];

const CABIN_OPTIONS = [
  { value: "ECONOMY", label: "Economy" },
  { value: "PREMIUM_ECONOMY", label: "Premium Economy" },
  { value: "BUSINESS", label: "Business" },
  { value: "FIRST", label: "First" },
];

function emptySegment(): FlightSegmentState {
  return { origin: "", originLabel: "", destination: "", destinationLabel: "", date: "" };
}

export function SearchForm() {
  const router = useRouter();
  const today = todayDateString();
  const [tripType, setTripType] = useState<TripType>("ONE_WAY");
  const [segments, setSegments] = useState<FlightSegmentState[]>([emptySegment()]);
  const [returnDate, setReturnDate] = useState("");
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);
  const [infants, setInfants] = useState(0);
  const [cabinClass, setCabinClass] = useState<CabinClass>("ECONOMY");
  const [error, setError] = useState<string | undefined>();

  function updateSegment(index: number, patch: Partial<FlightSegmentState>) {
    setSegments((current) =>
      current.map((segment, i) => (i === index ? { ...segment, ...patch } : segment)),
    );
  }

  function addSegment() {
    setSegments((current) => [...current, emptySegment()]);
  }

  function removeSegment(index: number) {
    setSegments((current) => current.filter((_, i) => i !== index));
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(undefined);

    if (segments.some((segment) => !segment.origin || !segment.destination || !segment.date)) {
      setError("Choose an origin, destination, and date for every flight");
      return;
    }
    if (infants > adults) {
      setError("Infants cannot outnumber adults");
      return;
    }
    if (tripType === "ROUND_TRIP" && !returnDate) {
      setError("Choose a return date");
      return;
    }

    const apiSegments =
      tripType === "ROUND_TRIP"
        ? [
            {
              origin: segments[0].origin,
              destination: segments[0].destination,
              departureDate: segments[0].date,
            },
            {
              origin: segments[0].destination,
              destination: segments[0].origin,
              departureDate: returnDate,
            },
          ]
        : segments.map((segment) => ({
            origin: segment.origin,
            destination: segment.destination,
            departureDate: segment.date,
          }));

    const params = new URLSearchParams({
      tripType,
      segments: JSON.stringify(apiSegments),
      adults: String(adults),
      children: String(children),
      infants: String(infants),
      cabinClass,
    });
    router.push(`/flights/search?${params.toString()}`);
  }

  return (
    <Card className="mx-auto w-full max-w-3xl p-6 text-left shadow-2xl">
      <form onSubmit={handleSubmit}>
        <div className="mb-4 flex gap-2">
          {TRIP_TYPES.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                setTripType(option.value);
                setSegments(
                  option.value === "MULTI_CITY"
                    ? [emptySegment(), emptySegment()]
                    : [emptySegment()],
                );
              }}
              className={
                "rounded-full px-3 py-1 text-sm font-medium transition-colors " +
                (tripType === option.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground")
              }
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-4">
          {segments.map((segment, index) => (
            <div key={index} className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <AirportAutocomplete
                label={index === 0 ? "From" : `From (flight ${index + 1})`}
                placeholder="New York (JFK)"
                displayValue={segment.originLabel}
                onSelect={(airport: AirportSummary) =>
                  updateSegment(index, {
                    origin: airport.iataCode,
                    originLabel: `${airport.city} (${airport.iataCode})`,
                  })
                }
              />
              <AirportAutocomplete
                label="To"
                placeholder="London (LHR)"
                displayValue={segment.destinationLabel}
                onSelect={(airport: AirportSummary) =>
                  updateSegment(index, {
                    destination: airport.iataCode,
                    destinationLabel: `${airport.city} (${airport.iataCode})`,
                  })
                }
              />
              <DatePickerField
                label={tripType === "MULTI_CITY" ? "Date" : "Depart"}
                value={segment.date}
                minDate={today}
                onChange={(date) => updateSegment(index, { date })}
              />

              {tripType === "ROUND_TRIP" && index === 0 ? (
                <DatePickerField
                  label="Return"
                  value={returnDate}
                  minDate={segment.date || today}
                  onChange={setReturnDate}
                />
              ) : tripType === "MULTI_CITY" ? (
                <div className="flex items-end">
                  {segments.length > 2 && (
                    <Button
                      type="button"
                      variant="secondary"
                      className="w-full"
                      onClick={() => removeSegment(index)}
                    >
                      Remove
                    </Button>
                  )}
                </div>
              ) : null}
            </div>
          ))}

          {tripType === "MULTI_CITY" && segments.length < 6 && (
            <Button type="button" variant="ghost" size="sm" className="self-start" onClick={addSegment}>
              + Add another flight
            </Button>
          )}

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium leading-none text-foreground">Adults</span>
              <input
                type="number"
                min={1}
                max={9}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                value={adults}
                onChange={(event) => setAdults(Number(event.target.value))}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium leading-none text-foreground">Children</span>
              <input
                type="number"
                min={0}
                max={9}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                value={children}
                onChange={(event) => setChildren(Number(event.target.value))}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium leading-none text-foreground">Infants</span>
              <input
                type="number"
                min={0}
                max={9}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                value={infants}
                onChange={(event) => setInfants(Number(event.target.value))}
              />
            </div>
            <Select
              label="Cabin"
              options={CABIN_OPTIONS}
              value={cabinClass}
              onChange={(value) => setCabinClass(value as CabinClass)}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" size="lg" className="w-full gap-2">
            <SearchNormal className="h-4 w-4" />
            Search flights
          </Button>
        </div>
      </form>
    </Card>
  );
}
