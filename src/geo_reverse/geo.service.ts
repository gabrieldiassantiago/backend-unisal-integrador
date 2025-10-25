import { Injectable, Logger } from "@nestjs/common";
import {Client} from "@googlemaps/google-maps-services-js";

interface ReverseCodeHeader {
    lat: number;
    long: number;
}

interface ReverseCodeResponse {
    localizacao: string;
}

@Injectable()
export class GeoService {
   private client = new Client({});
   private readonly logger = new Logger(GeoService.name);
   constructor() {}

   async reverseGeoCode(lat: number, long: number) : Promise<ReverseCodeResponse> {
    const response = await this.client.reverseGeocode({
        params: {
            key: process.env.GOOGLE_MAPS_API_KEY,
            latlng: [lat, long],
        }
    })
    const result = response.data.results[0];
    const localizacao = result.formatted_address;

     if (!response.data.results || response.data.results.length === 0) {
        throw new Error('Nenhum resultado encontrado para as coordenadas fornecidas.');
    }

    if (!result) {
        this.logger.warn(`Nenhum resultado encontrado para as coordenadas: lat=${lat}, long=${long}`);
    }

    return {
        localizacao
    }
    
   }
    
}
