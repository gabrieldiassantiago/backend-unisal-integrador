import { Injectable, Logger } from "@nestjs/common";
import { HttpService } from "@nestjs/axios";
import { ConfigService } from "@nestjs/config";


@Injectable()
export class GeoService {
   private readonly logger = new Logger(GeoService.name);
   constructor(private readonly httpService: HttpService,
    private readonly configService: ConfigService
   ) {}

   async reverseGeoCode(lat: number, long: number) : Promise<string> {

    try {
        const apiKey = this.configService.get<string>('GEO_API_KEY');
        const url = `https://api.geoapify.com/v1/geocode/reverse?lat=${lat}&lon=${long}&apiKey=${apiKey}`;

        const response = await this.httpService.axiosRef.get(url);
        const data = response.data;

        if (data && data.features && data.features.length > 0) {
            const address = data.features[0].properties.formatted;
            return address;
        } else {
            this.logger.warn(`No address found for coordinates: ${lat}, ${long}`);
            return 'Address not found';
        }        
    
    } catch (error) {
        this.logger.error(`Error during reverse geocoding: ${error.message}`);
        return 'Error';
    }

   }
    
}
