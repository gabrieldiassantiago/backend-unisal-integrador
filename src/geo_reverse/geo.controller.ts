import { Body, Controller, Post } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { GeoService } from './geo.service';
import { GeocodeDto } from './dto/geocode.dto';

@ApiTags('Geocoding')
@Controller('geo')
export class GeoController {
  constructor(private readonly geoService: GeoService) {}

  @Post('reverse')
  @ApiOperation({ summary: 'Reverse geocode coordinates to address' })
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
  async reverseGeocode(@Body() geocodeDto: GeocodeDto) {
    const { latitude, longitude } = geocodeDto;
    const address = await this.geoService.reverseGeoCode(latitude, longitude);
    
    return {
      address,
    };
  }
}
