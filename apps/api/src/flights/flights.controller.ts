import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { FlightSearchFiltersDto } from './dto/flight-search-filters.dto';
import { SearchFlightsDto } from './dto/search-flights.dto';
import { FlightsService } from './flights.service';

@Controller('flights')
export class FlightsController {
  constructor(private readonly flightsService: FlightsService) {}

  @Public()
  @Get('airports')
  searchAirports(@Query('query') query = '') {
    return this.flightsService.searchAirports(query);
  }

  @Public()
  @Post('search')
  search(@Body() dto: SearchFlightsDto) {
    return this.flightsService.search(dto);
  }

  @Public()
  @Get('search/:searchId')
  getResults(
    @Param('searchId') searchId: string,
    @Query() filters: FlightSearchFiltersDto,
  ) {
    return this.flightsService.getResults(searchId, filters);
  }
}
