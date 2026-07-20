import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Hex } from 'viem';
import { BookingsService } from '../bookings/bookings.service';
import { PrismaService } from '../prisma/prisma.service';
import { CeloService } from './celo.service';

export type PaymentAsset = 'USDM' | 'CELO';

export interface InitiatePaymentResult {
  contractAddress: string;
  /** Null for the native-CELO path — there's no ERC20 token to approve. */
  tokenAddress: string | null;
  /** The asset's smallest-unit amount (18 decimals), as a decimal string — too large for a JS number. */
  amount: string;
  bookingIdHash: string;
  isNative: boolean;
}

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly celo: CeloService,
    private readonly bookingsService: BookingsService,
  ) {}

  /**
   * Returns what the frontend needs to drive a deposit directly from the
   * customer's own connected wallet — no redirect URL, unlike a
   * Stripe/Paystack checkout session. Two asset paths: `USDM` (MiniPay users
   * — ERC20 approve() + deposit()) or `CELO` (everyone else — native
   * depositNative() with the quoted value attached, no approval needed).
   * Idempotent: calling this again for the same booking (e.g. a page
   * reload) reuses the existing Payment row rather than creating a second
   * one, and can still switch asset choice as long as nothing's been
   * deposited yet.
   */
  async initiate(
    bookingId: string,
    userId: string,
    asset: PaymentAsset,
  ): Promise<InitiatePaymentResult> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { flightBooking: true, payment: true },
    });
    if (!booking || booking.userId !== userId) {
      throw new NotFoundException('Booking not found');
    }
    if (!booking.flightBooking) {
      throw new BadRequestException('Booking has no flight reservation yet');
    }
    if (booking.currency !== 'USD') {
      throw new BadRequestException(
        `Unsupported booking currency for on-chain payment: ${booking.currency}`,
      );
    }
    if (booking.payment && booking.payment.status === 'SUCCEEDED') {
      throw new ConflictException('This booking has already been paid');
    }
    // Once a deposit has actually landed, the asset choice is locked in —
    // only allow switching (or picking for the first time) before that.
    if (
      booking.payment?.depositTxHash &&
      booking.payment.isNative !== (asset === 'CELO')
    ) {
      throw new ConflictException(
        'A deposit has already been made for this booking in a different asset',
      );
    }

    const isNative = asset === 'CELO';
    const bookingIdHash = this.celo.bookingIdHash(bookingId);
    const amount = isNative
      ? await this.celo.quoteNativeAmountForUsd(booking.totalAmountMinor)
      : this.celo.toTokenAmount(booking.totalAmountMinor);
    const tokenAddress = isNative ? null : this.celo.tokenAddress;

    if (!booking.payment) {
      await this.prisma.payment.create({
        data: {
          bookingId: booking.id,
          chainId: this.celo.chainId,
          tokenAddress,
          isNative,
          amountMinor: booking.totalAmountMinor,
          currency: booking.currency,
          escrowBookingIdHash: bookingIdHash,
          status: 'PENDING',
        },
      });
    } else if (booking.payment.isNative !== isNative) {
      await this.prisma.payment.update({
        where: { id: booking.payment.id },
        data: { isNative, tokenAddress },
      });
    }

    return {
      contractAddress: this.celo.escrowContractAddress,
      tokenAddress,
      amount: amount.toString(),
      bookingIdHash,
      isNative,
    };
  }

  /**
   * Verifies a deposit transaction on-chain, then releases it to the
   * treasury. Retriable: if a previous call verified the deposit but the
   * release() call itself failed transiently, calling this again skips
   * re-verification and just retries the release.
   */
  async confirm(bookingId: string, userId: string, txHash: string) {
    const { booking, payment } = await this.getOwnedPayment(bookingId, userId);

    if (payment.status === 'SUCCEEDED') {
      return this.bookingsService.getById(bookingId, userId);
    }
    if (payment.depositTxHash && payment.depositTxHash !== txHash) {
      throw new ConflictException(
        'A different deposit transaction was already recorded for this booking',
      );
    }

    if (!payment.depositTxHash) {
      await this.verifyDeposit(payment, txHash as Hex);
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { depositTxHash: txHash },
      });
    }

    const releaseTxHash = await this.celo.release(
      payment.escrowBookingIdHash as Hex,
    );

    await this.prisma.$transaction([
      this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: 'SUCCEEDED', releaseTxHash },
      }),
      this.prisma.booking.update({
        where: { id: booking.id },
        data: { status: 'CONFIRMED' },
      }),
    ]);

    return this.bookingsService.getById(bookingId, userId);
  }

  /**
   * Ops-only (see OpsSecretGuard). Only works pre-release — once release()
   * has moved funds to the treasury, the contract has nothing left to send
   * back, and a refund would need to be a manual treasury-side transfer
   * outside this contract entirely (see TASKS.md Phase 5's open question).
   */
  async refund(bookingId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { payment: true },
    });
    if (!booking || !booking.payment) {
      throw new NotFoundException('Booking or payment not found');
    }
    const payment = booking.payment;

    if (payment.status === 'REFUNDED') {
      throw new ConflictException('This payment has already been refunded');
    }
    if (payment.status === 'SUCCEEDED') {
      throw new BadRequestException(
        'This payment was already released to the treasury — refunding it now requires a manual treasury transfer, not this endpoint',
      );
    }
    if (!payment.depositTxHash) {
      throw new BadRequestException('No confirmed deposit to refund');
    }

    const refundTxHash = await this.celo.refund(
      payment.escrowBookingIdHash as Hex,
    );

    await this.prisma.$transaction([
      this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: 'REFUNDED', refundTxHash },
      }),
      this.prisma.booking.update({
        where: { id: booking.id },
        data: { status: 'CANCELLED' },
      }),
    ]);

    return { bookingId, status: 'REFUNDED' as const, refundTxHash };
  }

  private async getOwnedPayment(bookingId: string, userId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { payment: true },
    });
    if (!booking || booking.userId !== userId) {
      throw new NotFoundException('Booking not found');
    }
    if (!booking.payment) {
      throw new BadRequestException(
        'No payment has been initiated for this booking',
      );
    }
    return { booking, payment: booking.payment };
  }

  private async verifyDeposit(
    payment: {
      escrowBookingIdHash: string;
      amountMinor: number;
      isNative: boolean;
    },
    txHash: Hex,
  ): Promise<void> {
    const receipt = await this.celo.getTransactionReceipt(txHash);
    if (receipt.status !== 'success') {
      throw new BadRequestException('Deposit transaction did not succeed');
    }
    if (
      receipt.to?.toLowerCase() !==
      this.celo.escrowContractAddress.toLowerCase()
    ) {
      throw new BadRequestException(
        'Deposit transaction was not sent to the escrow contract',
      );
    }

    const deposits = this.celo.decodeDepositedLogs(receipt);
    const match = deposits.find(
      (deposit) =>
        deposit.bookingIdHash.toLowerCase() ===
        payment.escrowBookingIdHash.toLowerCase(),
    );
    if (!match) {
      throw new BadRequestException(
        'Deposit transaction has no matching Deposited event for this booking',
      );
    }
    if (match.isNative !== payment.isNative) {
      throw new BadRequestException(
        `Deposit was made in the wrong asset (expected ${payment.isNative ? 'native CELO' : 'USDm'})`,
      );
    }

    if (payment.isNative) {
      const acceptable = await this.celo.isNativeAmountAcceptable(
        payment.amountMinor,
        match.amount,
      );
      if (!acceptable) {
        throw new BadRequestException(
          `Deposited CELO amount (${match.amount}) is too far from the current quoted price for this booking`,
        );
      }
    } else {
      const expectedAmount = this.celo.toTokenAmount(payment.amountMinor);
      if (match.amount !== expectedAmount) {
        throw new BadRequestException(
          `Deposited amount (${match.amount}) does not match the expected amount (${expectedAmount})`,
        );
      }
    }
  }
}
