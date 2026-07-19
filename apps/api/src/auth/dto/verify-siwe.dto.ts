import { IsString } from 'class-validator';

export class VerifySiweDto {
  /** The full SIWE message the wallet signed, exactly as constructed on the frontend. */
  @IsString()
  message!: string;

  @IsString()
  signature!: string;
}
