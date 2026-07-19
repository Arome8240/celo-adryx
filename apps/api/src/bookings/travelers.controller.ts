import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/interfaces/jwt-payload.interface';
import { CreateSavedTravelerDto } from './dto/create-saved-traveler.dto';
import { TravelersService } from './travelers.service';

@Controller('travelers')
export class TravelersController {
  constructor(private readonly travelersService: TravelersService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.travelersService.list(user.userId);
  }

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateSavedTravelerDto,
  ) {
    return this.travelersService.create(user.userId, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.travelersService.remove(user.userId, id);
  }
}
