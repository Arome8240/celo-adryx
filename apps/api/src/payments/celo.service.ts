import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  http,
  keccak256,
  parseEventLogs,
  toBytes,
  type Hex,
  type PublicClient,
  type TransactionReceipt,
  type WalletClient,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { celo } from 'viem/chains';
import { FLIGHT_ESCROW_ABI } from './lib/flight-escrow-abi';

export interface EscrowState {
  payer: Hex;
  amount: bigint;
  /** 0 = None, 1 = Deposited, 2 = Released, 3 = Refunded — mirrors FlightEscrow.sol's Status enum. */
  status: number;
}

/** USDm (and every other Celo-native stable asset) uses 18 decimals, same as CELO itself. */
const TOKEN_DECIMALS = 18n;
/** Booking amounts are stored in USD cents (2 decimals) — see Booking.totalAmountMinor. */
const CURRENCY_DECIMALS = 2n;

/**
 * Owns the viem clients talking to the escrow contract. Configuration is
 * read lazily (not in the constructor) so the app can boot without these
 * vars set — only a payment-flow call actually needs them, same reasoning
 * as AmadeusAuthService's lazy client init.
 */
@Injectable()
export class CeloService {
  private publicClient: PublicClient | null = null;
  private walletClient: WalletClient | null = null;

  constructor(private readonly config: ConfigService) {}

  get escrowContractAddress(): Hex {
    return this.requireAddress('ESCROW_CONTRACT_ADDRESS');
  }

  get tokenAddress(): Hex {
    return this.requireAddress('USDM_TOKEN_ADDRESS');
  }

  get chainId(): number {
    return Number(this.requireString('CHAIN_ID'));
  }

  /** `keccak256(bytes(bookingId))` — identical on the contract side, so a Prisma cuid maps deterministically to the on-chain key. */
  bookingIdHash(bookingId: string): Hex {
    return keccak256(toBytes(bookingId));
  }

  /** USD cents -> the token's smallest unit (18 decimals). */
  toTokenAmount(amountMinor: number): bigint {
    return BigInt(amountMinor) * 10n ** (TOKEN_DECIMALS - CURRENCY_DECIMALS);
  }

  async getTransactionReceipt(hash: Hex): Promise<TransactionReceipt> {
    return this.getPublicClient().getTransactionReceipt({ hash });
  }

  /** Decodes every `Deposited` event in a receipt's logs — used to confirm a specific deposit actually happened, rather than trusting the caller's say-so. */
  decodeDepositedLogs(
    receipt: TransactionReceipt,
  ): Array<{ bookingIdHash: Hex; payer: Hex; amount: bigint }> {
    const decoded = parseEventLogs({
      abi: FLIGHT_ESCROW_ABI,
      eventName: 'Deposited',
      logs: receipt.logs,
    });
    return decoded.map((log) => ({
      bookingIdHash: log.args.bookingIdHash,
      payer: log.args.payer,
      amount: log.args.amount,
    }));
  }

  async getEscrow(bookingIdHash: Hex): Promise<EscrowState> {
    const [payer, amount, status] = (await this.getPublicClient().readContract({
      address: this.escrowContractAddress,
      abi: FLIGHT_ESCROW_ABI,
      functionName: 'escrows',
      args: [bookingIdHash],
    })) as [Hex, bigint, number];
    return { payer, amount, status };
  }

  /** Calls release() from the operator wallet and waits for the receipt — reverts surface as a thrown error. */
  async release(bookingIdHash: Hex): Promise<Hex> {
    return this.writeAndWait('release', bookingIdHash);
  }

  /** Calls refund() from the operator wallet and waits for the receipt — reverts surface as a thrown error. */
  async refund(bookingIdHash: Hex): Promise<Hex> {
    return this.writeAndWait('refund', bookingIdHash);
  }

  private async writeAndWait(
    functionName: 'release' | 'refund',
    bookingIdHash: Hex,
  ): Promise<Hex> {
    const wallet = this.getWalletClient();
    const publicClient = this.getPublicClient();
    if (!wallet.account) {
      throw new InternalServerErrorException('Operator wallet has no account');
    }

    const hash = await wallet.writeContract({
      address: this.escrowContractAddress,
      abi: FLIGHT_ESCROW_ABI,
      functionName,
      args: [bookingIdHash],
      account: wallet.account,
      chain: wallet.chain,
    });

    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status !== 'success') {
      throw new InternalServerErrorException(
        `FlightEscrow.${functionName}() reverted (tx ${hash})`,
      );
    }
    return hash;
  }

  private getPublicClient(): PublicClient {
    if (this.publicClient) return this.publicClient;
    this.publicClient = createPublicClient({
      chain: this.getChain(),
      transport: http(this.requireString('CELO_RPC_URL')),
    }) as PublicClient;
    return this.publicClient;
  }

  private getWalletClient(): WalletClient {
    if (this.walletClient) return this.walletClient;
    const rawKey = this.requireString('OPERATOR_PRIVATE_KEY');
    const account = privateKeyToAccount(
      (rawKey.startsWith('0x') ? rawKey : `0x${rawKey}`) as Hex,
    );
    this.walletClient = createWalletClient({
      account,
      chain: this.getChain(),
      transport: http(this.requireString('CELO_RPC_URL')),
    });
    return this.walletClient;
  }

  private getChain() {
    const chainId = this.chainId;
    if (chainId === celo.id) return celo;
    // Anything else (Celo Sepolia, or a local Hardhat node for testing) —
    // viem has no dedicated Celo Sepolia chain export yet, so define one
    // generically rather than misusing an unrelated chain's shape.
    return defineChain({
      id: chainId,
      name: `celo-chain-${chainId}`,
      nativeCurrency: celo.nativeCurrency,
      rpcUrls: { default: { http: [this.requireString('CELO_RPC_URL')] } },
    });
  }

  private requireString(key: string): string {
    const value = this.config.get<string>(key);
    if (!value) {
      throw new InternalServerErrorException(`${key} is not configured`);
    }
    return value;
  }

  private requireAddress(key: string): Hex {
    return this.requireString(key) as Hex;
  }
}
