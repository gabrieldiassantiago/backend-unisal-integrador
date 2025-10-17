export const emailCodeVerificationTemplate = (code: string, userName: string) => `
  <!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Verifique seu Email - InteliSensor</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #F8FAFC;">
  <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #F8FAFC;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        
        <!-- Main Container -->
        <table role="presentation" style="max-width: 600px; width: 100%; border-collapse: collapse; background-color: #FFFFFF; border-radius: 16px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
          
          <!-- Header com Logo -->
          <tr>
            <td style="padding: 40px 40px 20px 40px; text-align: center; background-color: #005BFF; border-radius: 16px 16px 0 0;">
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td align="center">
                    
                    <img src="logo2.svg" alt="InteliSensor Logo" width="360" height="40" style="display: block; margin: 0 auto 12px auto;" />
                      </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 48px 40px;">
              
              <!-- Saudação -->
              <h2 style="margin: 0 0 16px 0; color: #0F172A; font-size: 24px; font-weight: 700; line-height: 1.3;">
                Olá, ${userName}! 👋
              </h2>
              
              <p style="margin: 0 0 24px 0; color: #64748B; font-size: 16px; line-height: 1.6;">
                Bem-vindo ao <strong style="color: #0F172A;">InteliSensor</strong>! Para garantir a segurança da sua conta, precisamos verificar seu endereço de email.
              </p>
              
              <!-- Código de Verificação Box -->
              <table role="presentation" style="width: 100%; border-collapse: collapse; margin: 32px 0; border-radius: 16px;">
                <tr>
                  <td align="center" style="padding: 0;">
                    <table role="presentation" style="border-collapse: collapse; background: linear-gradient(135deg, #F0F7FF 0%, #E0F2FE 100%); border-radius: 16px">
                      <tr>
                        <td style="padding: 32px 24px; text-align: center; border-radius: 16px;">
                          <p style="margin: 0 0 12px 0; color: #64748B; font-size: 12px; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 600;">
                            CÓDIGO DE VERIFICAÇÃO
                          </p>
                          <p style="margin: 0; color: #005BFF; font-size: 42px; font-weight: 800; letter-spacing: 12px; font-family: 'Courier New', Courier, monospace; line-height: 1.2;">
                            ${code}
                          </p>
                          <p style="margin: 12px 0 0 0; color: #94A3B8; font-size: 13px;">
                            Digite este código no aplicativo
                          </p>
                          <button onclick="copyCode()" style="margin-top: 16px; padding: 10px 20px; background-color: #005BFF; color: #FFFFFF; border: none; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer;">
                            Copiar Código
                          </button>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              
              <!-- Instruções -->
              <div style="background-color: #FFF7ED; border-left: 4px solid #F59E0B; padding: 16px 20px; border-radius: 8px; margin: 24px 0;">
                <p style="margin: 0; color: #92400E; font-size: 14px; line-height: 1.6;">
                  ⏱️ <strong>Atenção:</strong> Este código expira em <strong>10 minutos</strong>. Se não solicitou esta verificação, ignore este email.
                </p>
              </div>
        
              
              <!-- Dica de Segurança -->
              <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #E2E8F0;">
                <table role="presentation" style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding-right: 16px; vertical-align: top; width: 32px;">
                      <div style="font-size: 24px;">🔒</div>
                    </td>
                    <td>
                      <p style="margin: 0 0 4px 0; color: #0F172A; font-size: 14px; font-weight: 600;">
                        Dica de Segurança
                      </p>
                      <p style="margin: 0; color: #64748B; font-size: 13px; line-height: 1.5;">
                        Nunca compartilhe este código com ninguém. Nossa equipe <strong>nunca</strong> solicitará este código por telefone ou email.
                      </p>
                    </td>
                  </tr>
                </table>
              </div>
              
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 32px 40px; background-color: #F8FAFC; border-radius: 0 0 16px 16px; text-align: center; border-top: 1px solid #E2E8F0;">
              <p style="margin: 0 0 8px 0; color: #64748B; font-size: 13px; font-weight: 500;">
                © ${new Date().getFullYear()} InteliSensor
              </p>
              <p style="margin: 0 0 16px 0; color: #94A3B8; font-size: 12px;">
                Tecnologia de Monitoramento de Quedas
              </p>
              <p style="margin: 0; color: #94A3B8; font-size: 11px; line-height: 1.4;">
                Este é um email automático, por favor não responda.<br/>
                Se tiver dúvidas, entre em contato pelo aplicativo.
              </p>
            </td>
          </tr>
          
        </table>
        
        <!-- Email Spacer -->
        <table role="presentation" style="max-width: 600px; width: 100%; margin-top: 24px;">
          <tr>
            <td align="center" style="padding: 0 20px;">
              <p style="margin: 0; color: #94A3B8; font-size: 11px; line-height: 1.5;">
                Você está recebendo este email porque criou uma conta no InteliSensor.<br/>
                <a href="#" style="color: #005BFF; text-decoration: underline;">Cancelar inscrição</a>
              </p>
            </td>
          </tr>
        </table>
        
      </td>
    </tr>
  </table>
</body>
</html>

<script>
  function copyCode() {
    const code = "${code}";
    navigator.clipboard.writeText(code).then(() => {
      alert("Código copiado para a área de transferência!");
    }).catch(err => {
      console.error("Erro ao copiar o código: ", err);
    });
  }
</script>
    `;