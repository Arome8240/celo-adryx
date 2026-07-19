import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class FlightSearchFiltersDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxStops?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minPriceMinor?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxPriceMinor?: number;

  /** Comma-separated IATA carrier codes, e.g. "TK,QR" */
  @IsOptional()
  @IsString()
  airlineCodes?: string;

  @IsOptional()
  @IsIn(['price', 'duration'])
  sort?: 'price' | 'duration';
}
