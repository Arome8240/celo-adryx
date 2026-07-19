import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
} from 'class-validator';

const PASSENGER_TYPES = ['ADULT', 'CHILD', 'INFANT'] as const;
const DOCUMENT_TYPES = ['NATIONAL_ID', 'PASSPORT'] as const;
const GENDERS = ['MALE', 'FEMALE'] as const;

export class PassengerDto {
  @IsEnum(PASSENGER_TYPES)
  type!: (typeof PASSENGER_TYPES)[number];

  @IsString()
  title!: string;

  @IsString()
  firstName!: string;

  @IsString()
  lastName!: string;

  /** Required by Amadeus's Flight Create Orders API for every traveler. */
  @IsEnum(GENDERS)
  gender!: (typeof GENDERS)[number];

  @IsDateString()
  dateOfBirth!: string;

  /** ISO 3166-1 alpha-2 — enforced on the frontend, passed through as-is here. */
  @IsString()
  nationality!: string;

  @IsEnum(DOCUMENT_TYPES)
  documentType!: (typeof DOCUMENT_TYPES)[number];

  @IsString()
  documentNumber!: string;

  /** Amadeus requires an expiry date on every traveler document, National ID included — not just passports. */
  @IsDateString()
  documentExpiry!: string;

  /** ISO 3166-1 alpha-2 (e.g. "NG") — required by Amadeus for every document. */
  @IsString()
  documentIssuingCountry!: string;

  /** If true, also saved to the user's saved-traveler list after booking succeeds. */
  @IsOptional()
  @IsBoolean()
  saveTraveler?: boolean;
}
