import { Matches } from 'class-validator';

export class ConfirmPaymentDto {
  @Matches(/^0x[0-9a-fA-F]{64}$/, {
    message: 'txHash must be a 32-byte transaction hash (0x-prefixed hex)',
  })
  txHash!: string;
}
