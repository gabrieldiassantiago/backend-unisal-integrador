export interface InfobipVerificationReminderParams {
  contactName: string;
  patientName: string;
  location: string;
  verificationTime: string;
}

/**
 * Template de texto livre para lembrete de verificação
 */
export const infobipVerificationReminderText = (params: InfobipVerificationReminderParams): string => {
  const { contactName, patientName, location, verificationTime } = params;

  return `⏰ *LEMBRETE DE VERIFICAÇÃO*

Olá, ${contactName}!

Você indicou que estava verificando o alerta de *${patientName}* às ${verificationTime}.

📍 Localização: ${location}

⚠️ Por favor, confirme o status pelo aplicativo InteliSensor ou responda esta mensagem.

Aguardamos seu retorno! 🙏`;
};

/**
 * Template aprovado no Infobip
 * Template Name: verification_reminder_pt
 * Placeholders: {{1}} = patientName, {{2}} = verificationTime
 */
export const infobipVerificationReminderTemplateData = (params: InfobipVerificationReminderParams) => {
  return {
    templateName: 'verification_reminder_pt',
    placeholders: [params.patientName, params.verificationTime],
    language: 'pt_BR',
  };
};
