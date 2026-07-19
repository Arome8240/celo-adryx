import { Module } from '@nestjs/common';
import { FlightsController } from './flights.controller';
import { FlightsService } from './flights.service';
import { AmadeusAuthService } from './providers/amadeus-auth.service';
import { AmadeusFlightProvider } from './providers/amadeus-flight.provider';

@Module({
  controllers: [FlightsController],
  providers: [FlightsService, AmadeusAuthService, AmadeusFlightProvider],
  exports: [FlightsService, AmadeusAuthService, AmadeusFlightProvider],
})
export class FlightsModule {}
