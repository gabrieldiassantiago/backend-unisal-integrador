export class alertNoExisting extends Error {
    constructor(alert: any) {
        super(`O alerta: ${alert} não foi encontrado.`);
        this.name = 'alertNoExisting';
    }
}