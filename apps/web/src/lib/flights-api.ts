import { request } from "./api-client";
import type {
  AirportSummary,
  FlightSearchParams,
  FlightSearchResponse,
} from "./flight-types";

export interface FlightSearchFilters {
  maxStops?: number;
  minPriceMinor?: number;
  maxPriceMinor?: number;
  airlineCodes?: string;
  sort?: "price" | "duration";
}

export const flightsApi = {
  async searchAirports(query: string): Promise<AirportSummary[]> {
    if (query.trim().length < 2) return [];
    return request<AirportSummary[]>(
      `/flights/airports?query=${encodeURIComponent(query)}`,
    );
  },

  search: (params: FlightSearchParams) =>
    request<FlightSearchResponse>("/flights/search", {
      method: "POST",
      body: JSON.stringify(params),
    }),

  getResults: (searchId: string, filters: FlightSearchFilters) => {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== "") query.set(key, String(value));
    }
    const suffix = query.toString();
    return request<FlightSearchResponse>(
      `/flights/search/${searchId}${suffix ? `?${suffix}` : ""}`,
    );
  },
};
