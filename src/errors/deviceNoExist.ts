export class deviceNotExisting extends Error {
    constructor(serial: string) {
        super(`Dispositivo com serial ${serial} não existe.`);
        this.name = 'deviceNotExisting';
    }
}