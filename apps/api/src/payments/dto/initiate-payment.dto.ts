import { IsIn } from 'class-validator';
import type { PaymentAsset } from '../payments.service';

const PAYMENT_ASSETS: PaymentAsset[] = ['USDM', 'CELO'];

export class InitiatePaymentDto {
  /** Which asset the customer's wallet will pay with — MiniPay wallets pay USDM, everyone else pays native CELO. */
  @IsIn(PAYMENT_ASSETS)
  asset!: PaymentAsset;
}
