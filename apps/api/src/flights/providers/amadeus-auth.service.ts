import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Amadeus from 'amadeus';
import { amadeusErrorMessage } from '../lib/amadeus-error';

/**
 * Owns the single Amadeus SDK client instance. The SDK handles the OAuth2
 * client-credentials token exchange, caching, and refresh internally; this
 * class only decides *which* credentials/host to hand it.
 */
@Injectable()
export class AmadeusAuthService {
  private client: Amadeus | null = null;

  constructor(private readonly config: ConfigService) {}

  getClient(): Amadeus {
    if (this.client) return this.client;

    const clientId = this.config.get<string>('AMADEUS_CLIENT_ID');
    const clientSecret = this.config.get<string>('AMADEUS_CLIENT_SECRET');
    if (!clientId || !clientSecret) {
      throw new InternalServerErrorException(
        'AMADEUS_CLIENT_ID/AMADEUS_CLIENT_SECRET are not configured',
      );
    }

    // The SDK defaults `hostname` to 'production' when omitted — always
    // pass it explicitly so an unset/mistyped AMADEUS_ENV can never
    // silently point test credentials at the production host or vice versa.
    const isProduction =
      this.config.get<string>('AMADEUS_ENV') === 'production';

    // The SDK's built-in `hostname` map resolves to api.amadeus.com /
    // test.api.amadeus.com, which no longer have any DNS record at all.
    // travel.api.amadeus.com / test.travel.api.amadeus.com are still live —
    // use that as an explicit `host` override instead of the SDK's dead
    // default.
    this.client = new Amadeus({
      clientId,
      clientSecret,
      hostname: isProduction ? 'production' : 'test',
      host: isProduction
        ? 'travel.api.amadeus.com'
        : 'test.travel.api.amadeus.com',
    });
    return this.client;
  }

  /**
   * Forces a real OAuth2 token fetch (or returns the SDK's own cached one) —
   * used by the health check, since there's no free/harmless real Amadeus
   * API call to exercise instead.
   */
  async getAccessToken(): Promise<string> {
    const amadeus = this.getClient();
    try {
      return await amadeus.client.accessToken.bearerToken(amadeus.client);
    } catch (err) {
      throw new InternalServerErrorException(
        `Amadeus auth failed: ${amadeusErrorMessage(err)}`,
      );
    }
  }
}
