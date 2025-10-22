import { Injectable } from "@nestjs/common";
import {Client} from "@googlemaps/google-maps-services-js";

@Injectable()
export class GeoService {
    private Client = new Client({});
    constructor() {}

    
}
