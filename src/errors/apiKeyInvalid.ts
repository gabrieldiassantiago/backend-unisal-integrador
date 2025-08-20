export class apiKeyInvalid extends Error {
    constructor(apikey: string) {
       super(`Api key: ${apikey} é inválida.`);
        this.name = 'apiKeyInvalid';
    }
}