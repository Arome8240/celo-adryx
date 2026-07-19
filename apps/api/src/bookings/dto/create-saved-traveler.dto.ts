import { IsDateString, IsEnum, IsString } from 'class-validator';

const DOCUMENT_TYPES = ['NATIONAL_ID', 'PASSPORT'] as const;

export class CreateSavedTravelerDto {
  @IsString()
  title!: string;

  @IsString()
  firstName!: string;

  @IsString()
  lastName!: string;

  @IsDateString()
  dateOfBirth!: string;

  @IsString()
  nationality!: string;

  @IsEnum(DOCUMENT_TYPES)
  documentType!: (typeof DOCUMENT_TYPES)[number];

  @IsString()
  documentNumber!: string;

  /** Required for every document type, National ID included — matches PassengerDto/the Amadeus requirement. */
  @IsDateString()
  documentExpiry!: string;

  @IsString()
  documentIssuingCountry!: string;
}
