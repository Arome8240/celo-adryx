import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsEnum,
  IsInt,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import type { CabinClass, TripType } from '../../../generated/prisma/client';
import { FlightSearchSegmentDto } from './flight-search-segment.dto';

const TRIP_TYPES: TripType[] = ['ONE_WAY', 'ROUND_TRIP', 'MULTI_CITY'];
const CABIN_CLASSES: CabinClass[] = [
  'ECONOMY',
  'PREMIUM_ECONOMY',
  'BUSINESS',
  'FIRST',
];

export class SearchFlightsDto {
  @IsEnum(TRIP_TYPES)
  tripType!: TripType;

  @ValidateNested({ each: true })
  @Type(() => FlightSearchSegmentDto)
  @ArrayMinSize(1)
  @ArrayMaxSize(6)
  segments!: FlightSearchSegmentDto[];

  @IsInt()
  @Min(1)
  @Max(9)
  adults!: number;

  @IsInt()
  @Min(0)
  @Max(9)
  children = 0;

  @IsInt()
  @Min(0)
  @Max(9)
  infants = 0;

  @IsEnum(CABIN_CLASSES)
  cabinClass!: CabinClass;
}
