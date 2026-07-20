"use client";

import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { AirlineLogo } from "./AirlineLogo";

export interface FlightFiltersState {
  maxStops?: number;
  minPriceMinor?: number;
  maxPriceMinor?: number;
  airlineCodes: string[];
  sort: "price" | "duration";
}

interface FilterSidebarProps {
  filters: FlightFiltersState;
  availableAirlines: string[];
  onChange: (patch: Partial<FlightFiltersState>) => void;
}

const STOP_OPTIONS = [
  { value: "", label: "Any" },
  { value: "0", label: "Direct only" },
  { value: "1", label: "1 stop or fewer" },
];

const SORT_OPTIONS = [
  { value: "price", label: "Cheapest first" },
  { value: "duration", label: "Fastest first" },
];

export function FilterSidebar({
  filters,
  availableAirlines,
  onChange,
}: FilterSidebarProps) {
  return (
    <Card className="flex flex-col gap-5 p-5">
      <Select
        label="Sort by"
        options={SORT_OPTIONS}
        value={filters.sort}
        onChange={(value) => onChange({ sort: value as "price" | "duration" })}
      />

      <Select
        label="Stops"
        options={STOP_OPTIONS}
        value={filters.maxStops === undefined ? "" : String(filters.maxStops)}
        onChange={(value) =>
          onChange({ maxStops: value === "" ? undefined : Number(value) })
        }
      />

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium leading-none text-foreground">
          Price range (USD)
        </span>
        <div className="flex gap-2">
          <input
            type="number"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            placeholder="Min"
            value={filters.minPriceMinor ? filters.minPriceMinor / 100 : ""}
            onChange={(event) =>
              onChange({
                minPriceMinor: event.target.value
                  ? Number(event.target.value) * 100
                  : undefined,
              })
            }
          />
          <input
            type="number"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            placeholder="Max"
            value={filters.maxPriceMinor ? filters.maxPriceMinor / 100 : ""}
            onChange={(event) =>
              onChange({
                maxPriceMinor: event.target.value
                  ? Number(event.target.value) * 100
                  : undefined,
              })
            }
          />
        </div>
      </div>

      {availableAirlines.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium leading-none text-foreground">Airlines</span>
          <div className="flex flex-col gap-2">
            {availableAirlines.map((code) => (
              <label key={code} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-input"
                  checked={filters.airlineCodes.includes(code)}
                  onChange={(event) => {
                    const next = event.target.checked
                      ? [...filters.airlineCodes, code]
                      : filters.airlineCodes.filter((c) => c !== code);
                    onChange({ airlineCodes: next });
                  }}
                />
                <AirlineLogo code={code} size={16} />
                {code}
              </label>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
