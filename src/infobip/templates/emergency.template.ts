export interface InfobipEmergencyParams {
  contactName: string;
  patientName: string;
  location: string;
  priority: number;
}

/**
 * Template de texto livre para emergência confirmada
 */
export const infobipEmergencyText = (params: InfobipEmergencyParams): string => {
  const { contactName, patientName, location, priority } = params;
  const priorityText = priority === 1 
    ? '\n\n⭐ Você é o contato prioritário!' 
    : `\n\n(Contato de prioridade ${priority})`;

  return `🚨 *EMERGÊNCIA - Queda Confirmada*

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

/**
 * Template aprovado no Infobip
 * Template Name: emergency_confirmed_pt
 * Placeholders: {{1}} = patientName, {{2}} = location
 */
export const infobipEmergencyTemplateData = (params: InfobipEmergencyParams) => {
  return {
    templateName: 'emergency_confirmed_pt',
    placeholders: [params.patientName, params.location],
    language: 'pt_BR',
  };
};
