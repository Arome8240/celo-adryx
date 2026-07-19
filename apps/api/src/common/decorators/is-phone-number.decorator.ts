import { registerDecorator, type ValidationOptions } from 'class-validator';
import { isValidPhoneNumber } from '../lib/phone';

/** The one phone-format validator used across every DTO that collects a phone number. */
export function IsPhoneNumber(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isPhoneNumber',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown): boolean {
          return typeof value === 'string' && isValidPhoneNumber(value);
        },
        defaultMessage(): string {
          return '$property must be a valid phone number in E.164 format (e.g. +2348012345678)';
        },
      },
    });
  };
}
