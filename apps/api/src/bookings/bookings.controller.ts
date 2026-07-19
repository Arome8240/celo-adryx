import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/interfaces/jwt-payload.interface';
import { BookingsService } from './bookings.service';
import { CreateFlightBookingDto } from './dto/create-flight-booking.dto';
import { ListBookingsQueryDto } from './dto/list-bookings-query.dto';

@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListBookingsQueryDto,
  ) {
    return this.bookingsService.list(user.userId, query);
  }

  @Get(':id')
  getById(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.bookingsService.getById(id, user.userId);
  }

  @Post('flights')
  createFlightBooking(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateFlightBookingDto,
  ) {
    return this.bookingsService.createFlightBooking(user.userId, dto);
  }
}
