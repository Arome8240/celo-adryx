"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import {
  FilterSidebar,
  type FlightFiltersState,
} from "@/components/flights/FilterSidebar";
import { FlightResultCard } from "@/components/flights/FlightResultCard";
import { flightsApi } from "@/lib/flights-api";
import type { FlightSearchParams, FlightSearchResponse } from "@/lib/flight-types";

export default function FlightSearchResultsPage() {
  return (
    <Suspense fallback={null}>
      <FlightSearchResults />
    </Suspense>
  );
}

function parseFilters(searchParams: URLSearchParams): FlightFiltersState {
  const maxStops = searchParams.get("maxStops");
  const minPrice = searchParams.get("minPriceMinor");
  const maxPrice = searchParams.get("maxPriceMinor");
  const airlines = searchParams.get("airlineCodes");
  const sort = searchParams.get("sort");

  return {
    maxStops: maxStops ? Number(maxStops) : undefined,
    minPriceMinor: minPrice ? Number(minPrice) : undefined,
    maxPriceMinor: maxPrice ? Number(maxPrice) : undefined,
    airlineCodes: airlines ? airlines.split(",").filter(Boolean) : [],
    sort: sort === "duration" ? "duration" : "price",
  };
}

function FlightSearchResults() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [response, setResponse] = useState<FlightSearchResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();

  const searchId = searchParams.get("searchId");
  const filters = parseFilters(searchParams);

  const updateUrl = useCallback(
    (nextSearchId: string, nextFilters: Partial<FlightFiltersState>) => {
      const merged = { ...filters, ...nextFilters };
      const params = new URLSearchParams();
      params.set("searchId", nextSearchId);
      if (merged.sort) params.set("sort", merged.sort);
      if (merged.maxStops !== undefined) params.set("maxStops", String(merged.maxStops));
      if (merged.minPriceMinor !== undefined)
        params.set("minPriceMinor", String(merged.minPriceMinor));
      if (merged.maxPriceMinor !== undefined)
        params.set("maxPriceMinor", String(merged.maxPriceMinor));
      if (merged.airlineCodes.length > 0)
        params.set("airlineCodes", merged.airlineCodes.join(","));
      router.replace(`${pathname}?${params.toString()}`);
    },
    [filters, pathname, router],
  );

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setLoading(true);
      setError(undefined);
      try {
        if (searchId) {
          const result = await flightsApi.getResults(searchId, {
            maxStops: filters.maxStops,
            minPriceMinor: filters.minPriceMinor,
            maxPriceMinor: filters.maxPriceMinor,
            airlineCodes: filters.airlineCodes.join(",") || undefined,
            sort: filters.sort,
          });
          if (!cancelled) setResponse(result);
        } else {
          const segmentsRaw = searchParams.get("segments");
          if (!segmentsRaw) {
            setError("Missing search criteria — start a new search.");
            return;
          }
          const params: FlightSearchParams = {
            tripType:
              (searchParams.get("tripType") as FlightSearchParams["tripType"]) ?? "ONE_WAY",
            segments: JSON.parse(segmentsRaw),
            adults: Number(searchParams.get("adults") ?? 1),
            children: Number(searchParams.get("children") ?? 0),
            infants: Number(searchParams.get("infants") ?? 0),
            cabinClass:
              (searchParams.get("cabinClass") as FlightSearchParams["cabinClass"]) ??
              "ECONOMY",
          };
          const result = await flightsApi.search(params);
          if (!cancelled) {
            setResponse(result);
            updateUrl(result.searchId, {});
          }
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Search failed");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchId, searchParams.toString()]);

  function handleFilterChange(patch: Partial<FlightFiltersState>) {
    if (response) updateUrl(response.searchId, patch);
  }

  return (
    <main className="container max-w-6xl py-8">
      <h1 className="mb-6 text-2xl font-semibold text-foreground">Flight results</h1>

      {error ? (
        <p className="rounded-lg border bg-card p-4 text-destructive">{error}</p>
      ) : (
        <div className="grid gap-6 sm:grid-cols-[16rem_1fr]">
          <FilterSidebar
            filters={filters}
            availableAirlines={response?.availableAirlineCodes ?? []}
            onChange={handleFilterChange}
          />

          <div className="flex flex-col gap-4">
            {loading ? (
              <>
                <Skeleton className="h-24" />
                <Skeleton className="h-24" />
                <Skeleton className="h-24" />
              </>
            ) : response && response.offers.length > 0 ? (
              <>
                <p className="text-sm text-muted-foreground">
                  {response.filteredCount} of {response.totalCount} flights
                </p>
                {response.offers.map((offer) => (
                  <FlightResultCard
                    key={offer.id}
                    offer={offer}
                    searchId={response.searchId}
                    tripType={response.tripType}
                    adults={response.adults}
                    childrenCount={response.children}
                    infants={response.infants}
                  />
                ))}
              </>
            ) : (
              <p className="rounded-lg border bg-card p-4 text-muted-foreground">
                No flights found — try adjusting your filters or search again.
              </p>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
