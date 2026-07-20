// The `amadeus` npm package ships no TypeScript types at all (no bundled
// .d.ts, no @types/amadeus package exists). This declares only the surface
// this codebase actually calls — OAuth2 token cache, Flight Offers Search,
// Flight Offers Price, and Flight Create Orders — so every file using the
// SDK stays fully type-checked instead of falling back to implicit `any`.
declare module 'amadeus' {
  export interface AmadeusConfig {
    clientId: string;
    clientSecret: string;
    hostname?: 'test' | 'production';
    /** Overrides the SDK's built-in hostname-to-host lookup entirely. */
    host?: string;
  }

  export interface AmadeusFlightOrderResponse {
    type: string;
    id: string;
    associatedRecords?: Array<{ reference?: string }>;
  }

  export default class Amadeus {
    constructor(config: AmadeusConfig);
    client: {
      accessToken: { bearerToken(client: unknown): Promise<string> };
    };
    shopping: {
      flightOffersSearch: {
        get(params: Record<string, string>): Promise<{ data?: unknown[] }>;
        post(body: unknown): Promise<{ data?: unknown[] }>;
      };
      flightOffers: {
        pricing: {
          post(body: unknown): Promise<{ data?: { flightOffers?: unknown[] } }>;
        };
      };
    };
    booking: {
      flightOrders: {
        post(body: unknown): Promise<{ data?: AmadeusFlightOrderResponse }>;
      };
    };
    referenceData: {
      locations: {
        get(params: {
          keyword: string;
          subType: string;
        }): Promise<{ data?: unknown[] }>;
      };
    };
  }
}
