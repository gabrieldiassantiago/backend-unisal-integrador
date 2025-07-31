export class ExistingError extends Error {
    constructor(email: string) {
        super(`Já existe um usuário com o email ${email}.`);
        this.name = 'ExistingError';
    }
}