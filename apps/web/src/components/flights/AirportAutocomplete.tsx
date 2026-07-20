"use client";

import { useEffect, useRef, useState } from "react";
import { MapPin } from "lucide-react";
import type { AirportSummary } from "@/lib/flight-types";
import { flightsApi } from "@/lib/flights-api";

export interface AirportAutocompleteProps {
  label: string;
  placeholder?: string;
  displayValue: string;
  onSelect: (airport: AirportSummary) => void;
}

export function AirportAutocomplete({
  label,
  placeholder,
  displayValue,
  onSelect,
}: AirportAutocompleteProps) {
  const [query, setQuery] = useState(displayValue);
  const [results, setResults] = useState<AirportSummary[]>([]);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => setQuery(displayValue), [displayValue]);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    const handle = setTimeout(() => {
      flightsApi
        .searchAirports(query)
        .then(setResults)
        .catch(() => setResults([]));
    }, 250);
    return () => clearTimeout(handle);
  }, [query]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative flex flex-col gap-1.5" ref={rootRef}>
      <span className="text-sm font-medium leading-none text-foreground">{label}</span>
      <div className="relative">
        <MapPin className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          className="flex h-10 w-full rounded-md border border-input bg-background py-2 pl-8 pr-3 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          placeholder={placeholder}
          required
          autoComplete="off"
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
        />
      </div>
      {open && results.length > 0 && (
        <div className="absolute top-full z-10 mt-1 max-h-60 w-full overflow-auto rounded-md border bg-popover p-1 shadow-md">
          {results.map((airport) => (
            <div
              key={airport.iataCode}
              className="flex cursor-pointer items-center justify-between rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
              onClick={() => {
                onSelect(airport);
                setQuery(`${airport.city} (${airport.iataCode})`);
                setOpen(false);
              }}
            >
              <span>
                {airport.city} ({airport.iataCode})
              </span>
              <span className="text-xs text-muted-foreground">{airport.country}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
