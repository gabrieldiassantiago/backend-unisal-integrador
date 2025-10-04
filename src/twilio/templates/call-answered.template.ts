export interface CallAnsweredTemplateParams {
  contactName: string;
  patientName: string;
}

export const callAnsweredTemplate = (params: CallAnsweredTemplateParams): string => {
  const { contactName, patientName } = params;

  return `Obrigado por atender, ${contactName}! 💚

Contamos com você para ajudar *${patientName}*.

O alerta foi automaticamente marcado como RESOLVIDO porque você atendeu à chamada. Se precisar de suporte, estamos aqui!`;
};
