export interface FallAlertTemplateParams {
  contactName: string;
  patientName: string;
  location: string;
  priority: number;
}

export const fallAlertTemplate = (params: FallAlertTemplateParams): string => {
  const { contactName, patientName, location, priority } = params;
  const priorityText = priority === 1 
    ? '\n\n⭐ Você é o contato prioritário!' 
    : `\n\n(Contato de prioridade ${priority})`;

        return `🚨 ALERTA DE QUEDA

        Olá, ${contactName}!

        Detectamos uma possível queda de *${patientName}*.

        📍 Localização: ${location}

        Por favor, nos ajude respondendo:
        ✅ "Falso Alerta" - se souber que está tudo bem
        🏃 "Estou Indo Verificar" - se vai checar pessoalmente

        Contamos com você! 🙏${priorityText}`;
        };

export const fallAlertCallTwiml = (patientName: string): string => {
  return `<Response><Say language="pt-BR">Aqui é o sistema de monitoramento. O paciente ${patientName} sofreu uma queda. Por favor, entre em contato imediatamente.</Say></Response>`;
};
