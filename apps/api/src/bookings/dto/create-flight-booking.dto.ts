import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsEmail,
  IsEnum,
  IsString,
  ValidateNested,
} from 'class-validator';
import type { TripType } from '../../../generated/prisma/client';
import { IsPhoneNumber } from '../../common/decorators/is-phone-number.decorator';
import { PassengerDto } from './passenger.dto';

const TRIP_TYPES: TripType[] = ['ONE_WAY', 'ROUND_TRIP', 'MULTI_CITY'];

export class CreateFlightBookingDto {
  @IsString()
  searchId!: string;

  @IsString()
  offerId!: string;

  /** Passed through from the search the offer came from — never re-derived from itinerary count, which is ambiguous (a round trip and a 2-city multi-city both produce 2 itineraries). */
  @IsEnum(TRIP_TYPES)
  tripType!: TripType;

  @IsEmail()
  contactEmail!: string;

  @IsPhoneNumber()
  contactPhone!: string;

  @ValidateNested({ each: true })
  @Type(() => PassengerDto)
  @ArrayMinSize(1)
  passengers!: PassengerDto[];
}
