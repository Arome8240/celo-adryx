import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import type { BookingStatus } from '../../../generated/prisma/client';

const BOOKING_STATUSES: BookingStatus[] = [
  'PENDING',
  'CONFIRMED',
  'CANCELLED',
  'COMPLETED',
  'FAILED',
];

export class ListBookingsQueryDto {
  /** Matches against contact email/phone — never client-side-only. */
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsIn(BOOKING_STATUSES)
  status?: BookingStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  pageSize = 10;
}
