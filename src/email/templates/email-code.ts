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
                    <!-- Ícone de Email -->
                    <div style="width: 64px; height: 64px; margin: 0 auto 16px; background-color: rgba(255, 255, 255, 0.2); border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                      <div style="font-size: 32px; line-height: 64px;">✉️</div>
                    </div>
                    <h1 style="margin: 0; color: #FFFFFF; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">InteliSensor</h1>
                    <p style="margin: 8px 0 0 0; color: rgba(255, 255, 255, 0.9); font-size: 14px; font-weight: 500;">Sistema de Monitoramento de Quedas</p>
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
              <table role="presentation" style="width: 100%; border-collapse: collapse; margin: 32px 0;">
                <tr>
                  <td align="center" style="padding: 0;">
                    <table role="presentation" style="border-collapse: collapse; background: linear-gradient(135deg, #F0F7FF 0%, #E0F2FE 100%); border-radius: 12px; border: 2px solid #005BFF;">
                      <tr>
                        <td style="padding: 32px 24px; text-align: center;">
                          <p style="margin: 0 0 12px 0; color: #64748B; font-size: 12px; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 600;">
                            CÓDIGO DE VERIFICAÇÃO
                          </p>
                          <p style="margin: 0; color: #005BFF; font-size: 42px; font-weight: 800; letter-spacing: 12px; font-family: 'Courier New', Courier, monospace; line-height: 1.2;">
                            ${code}
                          </p>
                          <p style="margin: 12px 0 0 0; color: #94A3B8; font-size: 13px;">
                            Digite este código no aplicativo
                          </p>
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
              
              <!-- Call to Action -->
              <table role="presentation" style="width: 100%; border-collapse: collapse; margin: 32px 0;">
                <tr>
                  <td align="center">
                    <p style="margin: 0 0 16px 0; color: #64748B; font-size: 15px;">
                      Problemas para inserir o código?
                    </p>
                    <a href="#" style="display: inline-block; padding: 14px 32px; background-color: #005BFF; color: #FFFFFF; text-decoration: none; border-radius: 12px; font-weight: 600; font-size: 15px; letter-spacing: 0.3px;">
                      Abrir no Navegador
                    </a>
                  </td>
                </tr>
              </table>
              
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
    `;