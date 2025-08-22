export class PatientNotFoundError extends Error {
    constructor(patientId: string) {
        super(`Paciente com ID ${patientId} não encontrado.`);
        this.name = 'PatientNotFoundError';
    }
}