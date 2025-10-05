export interface FalseAlarmTemplateParams {
  patientName: string;
  responderName: string;
}

export const falseAlarmTemplate = (params: FalseAlarmTemplateParams): string => {
  const { patientName, responderName } = params;

  return `✅ FALSO ALARME

        Oi! 😊

        Boas notícias sobre *${patientName}*!

        ${responderName} confirmou que foi um *falso alarme*. Tudo está bem! ✨

        Você pode ficar tranquilo(a). 💚`;
        };
