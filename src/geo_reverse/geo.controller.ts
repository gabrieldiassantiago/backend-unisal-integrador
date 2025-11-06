import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { GeoService } from './geo.service';

@ApiTags('Geocoding')
@Controller('geo')
export class GeoController {
  constructor(private readonly geoService: GeoService) {}

  @Get('reverse')
  @ApiOperation({ summary: 'Reverse geocode coordinates to address' })
  @ApiQuery({ name: 'latitude', type: Number, description: 'Latitude coordinate', example: -23.5505 })
  @ApiQuery({ name: 'longitude', type: Number, description: 'Longitude coordinate', example: -46.6333 })
  @ApiResponse({ 
    status: 200, 
    description: 'Returns the formatted address for the given coordinates',
    schema: {
      type: 'object',
      properties: {
        address: { type: 'string' }
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Invalid coordinates provided' })
  async reverseGeocode(
    @Query('latitude') latitude: string,
    @Query('longitude') longitude: string
  ) {
    const lat = parseFloat(latitude);
    const long = parseFloat(longitude);
    const address = await this.geoService.reverseGeoCode(lat, long);

    if (address.length < 0) {
      throw new BadRequestException("Coordenadas inválidas");
    }
    
    return {
      address,
    };
  }
}
