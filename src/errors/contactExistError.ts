export class ContactExistError extends Error {
    constructor() {
        super('Já existe um contato de emergência para este paciente')
    }
}