export interface InfobipFallAlertParams {
  contactName: string;
  patientName: string;
  location: string;
  priority: number;
}

/**
 * Template de texto livre para alerta de queda (usado dentro da janela de 24h)
 */
export const infobipFallAlertText = (params: InfobipFallAlertParams): string => {
  const { contactName, patientName, location, priority } = params;
  const priorityText = priority === 1 
    ? '\n\n⭐ Você é o contato prioritário!' 
    : `\n\n(Contato de prioridade ${priority})`;

  return `🚨 *ALERTA DE QUEDA*

Olá, ${contactName}!

Detectamos uma possível queda de *${patientName}*.

📍 Localização: ${location}

Por favor, nos ajude respondendo:
✅ "Falso Alerta" - se souber que está tudo bem
🏃 "Estou Indo Verificar" - se vai checar pessoalmente

Contamos com você! 🙏${priorityText}`;
};

/**
 * Dados do template aprovado no Infobip para iniciar conversação
 * Template Name: fall_alert_template_pt
 * Placeholders: {{1}} = patientName, {{2}} = location
 */
export const infobipFallAlertTemplateData = (params: InfobipFallAlertParams) => {
  return {
    templateName: 'fall_alert_template_pt', // Nome do template aprovado no Infobip
    placeholders: [params.patientName, params.location],
    language: 'pt_BR',
  };
};
