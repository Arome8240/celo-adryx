import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';
import { IsPhoneNumber } from '../../common/decorators/is-phone-number.decorator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  lastName?: string;

  @IsOptional()
  @IsPhoneNumber()
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;
}
