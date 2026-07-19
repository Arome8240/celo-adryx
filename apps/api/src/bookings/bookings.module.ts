import { Module } from '@nestjs/common';
import { FlightsModule } from '../flights/flights.module';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';
import { TravelersController } from './travelers.controller';
import { TravelersService } from './travelers.service';

@Module({
  imports: [FlightsModule],
  controllers: [BookingsController, TravelersController],
  providers: [BookingsService, TravelersService],
  exports: [BookingsService],
})
export class BookingsModule {}
