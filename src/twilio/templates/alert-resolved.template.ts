export interface AlertResolvedTemplateParams {
  patientName: string;
  responderName: string;
  resolvedByCall: boolean;
}

export const alertResolvedTemplate = (params: AlertResolvedTemplateParams): string => {
  const { patientName, responderName, resolvedByCall } = params;
  const resolveMethod = resolvedByCall 
    ? 'atendeu à chamada' 
    : 'confirmou através do aplicativo';

  return `✅ ALERTA RESOLVIDO

${responderName} já ${resolveMethod} sobre ${patientName}.

O alerta foi marcado como RESOLVIDO. Não é necessária mais nenhuma ação da sua parte.

Obrigado pela atenção! 🙏`;
};
