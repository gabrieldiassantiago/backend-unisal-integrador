export interface InfobipFalseAlarmParams {
  patientName: string;
  responderName: string;
}

/**
 * Template de texto livre para falso alarme
 */
export const infobipFalseAlarmText = (params: InfobipFalseAlarmParams): string => {
  const { patientName, responderName } = params;

  return `✅ *FALSO ALARME*

Oi! 😊

Boas notícias sobre *${patientName}*!

${responderName} confirmou que foi um *falso alarme*. Tudo está bem! ✨

Você pode ficar tranquilo(a). 💚`;
};

/**
 * Template aprovado no Infobip
 * Template Name: false_alarm_pt
 * Placeholders: {{1}} = responderName, {{2}} = patientName
 */
export const infobipFalseAlarmTemplateData = (params: InfobipFalseAlarmParams) => {
  return {
    templateName: 'false_alarm_pt',
    placeholders: [params.responderName, params.patientName],
    language: 'pt_BR',
  };
};
