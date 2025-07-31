export class noFoundUser extends Error {
    constructor(userId: string) {
        super(`Usuário com ID ${userId} não encontrado.`);
        this.name = 'noFoundUser';
    }
}