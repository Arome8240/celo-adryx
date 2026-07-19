import { Transform } from 'class-transformer';
import { IsDateString, IsString, Length, Matches } from 'class-validator';

export class FlightSearchSegmentDto {
  @Transform(({ value }) =>
    typeof value === 'string' ? value.toUpperCase() : value,
  )
  @IsString()
  @Length(3, 3)
  @Matches(/^[A-Z]{3}$/, { message: 'origin must be a 3-letter IATA code' })
  origin!: string;

  @Transform(({ value }) =>
    typeof value === 'string' ? value.toUpperCase() : value,
  )
  @IsString()
  @Length(3, 3)
  @Matches(/^[A-Z]{3}$/, {
    message: 'destination must be a 3-letter IATA code',
  })
  destination!: string;

  @IsDateString()
  departureDate!: string;
}
