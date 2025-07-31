export class existingDevicePair extends Error {
    constructor(serial: string) {
        super(`Já existe um dispositivo pareado com o serial ${serial}.`);
        this.name = 'existingDevicePaired';
    }
}