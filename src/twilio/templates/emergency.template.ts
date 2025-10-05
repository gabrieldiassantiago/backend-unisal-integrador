export interface EmergencyTemplateParams {
  contactName: string;
  patientName: string;
  location: string;
  priority: number;
}

export const emergencyConfirmedTemplate = (params: EmergencyTemplateParams): string => {
  const { contactName, patientName, location, priority } = params;
  const priorityText = priority === 1 
    ? '\n\n⭐ Você é o contato prioritário!' 
    : `\n\n(Contato de prioridade ${priority})`;

  return `🚨 EMERGÊNCIA - Queda Confirmada

        Olá, ${contactName}!

        *${patientName}* sofreu uma queda e precisa de ajuda URGENTE!

        📍 Última localização conhecida:
        ${location}

        ⚠️ Por favor:
        • Vá verificar o mais rápido possível
        • Ligue para emergência se necessário (192/193)
        • Avise outros familiares

        Cada segundo conta! 🙏${priorityText}`;
        };
