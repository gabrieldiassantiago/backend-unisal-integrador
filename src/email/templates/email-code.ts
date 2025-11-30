export const emailCodeVerificationTemplate = (code: string, userName: string) => `
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Código de Verificação InteliSensor</title>
  <style type="text/css">
    body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #F5F5F7; color: #1D1D1F; }
    table { border-collapse: collapse; }
    h1 { margin: 0; }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #F5F5F7;">
  
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #F5F5F7;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        
        <!-- Cartão Principal -->
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 480px; background-color: #FFFFFF; border-radius: 24px; box-shadow: 0 8px 30px rgba(0,0,0,0.04); overflow: hidden;">
          
          <!-- Logo Header -->
          <tr>
            <td align="center" style="padding: 48px 0 24px 0;">
               <!-- SVG Compacto e Centralizado -->
               <img src="https://i.imgur.com/JuRCheh.png" width="180" alt="InteliSensor" style="display: block; border: 0; user-select: none;" />
               <!-- Nota: Se preferir o SVG inline estrito, use o bloco abaixo, mas img tag é 100% mais seguro para email -->
            </td>
          </tr>
          
          <!-- Conteúdo -->
          <tr>
            <td align="center" style="padding: 0 40px 48px 40px;">
              
              <h1 style="font-size: 24px; font-weight: 700; color: #1D1D1F; letter-spacing: -0.5px; margin-bottom: 12px;">
                Verifique seu login
              </h1>
              
              <p style="font-size: 15px; line-height: 1.5; color: #86868B; margin: 0 0 32px 0;">
                Olá, ${userName}.<br>Use o código abaixo para acessar o <strong>InteliSensor</strong>.
              </p>
              
              <!-- Caixa do Código -->
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center">
                    <div style="background-color: #F5F5F7; border-radius: 16px; padding: 20px 0; width: 100%; max-width: 320px;">
                      <span style="font-family: SF Mono, Menlo, monospace; font-size: 32px; font-weight: 600; color: #1D1D1F; letter-spacing: 6px; display: block; text-align: center;">
                        ${code}
                      </span>
                    </div>
                  </td>
                </tr>
              </table>

              <p style="margin: 24px 0 0 0; font-size: 13px; color: #86868B;">
                Válido por 10 minutos.
              </p>

              <!-- Divisor -->
              <div style="height: 1px; background-color: #E5E5EA; margin: 32px 0; width: 100%;"></div>

              <!-- Rodapé de Segurança -->
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center">
                    <img src="https://img.icons8.com/material-outlined/24/86868b/lock--v1.png" width="16" height="16" alt="" style="vertical-align: middle; opacity: 0.7; margin-bottom: 8px;" />
                    <p style="margin: 0; font-size: 12px; color: #86868B; line-height: 1.4; max-width: 280px;">
                      Se não foi você, fique tranquilo. Sua conta está segura.
                    </p>
                  </td>
                </tr>
              </table>

            </td>
          </tr>
          
        </table>
        
        <!-- Footer Externo -->
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-top: 24px;">
          <tr>
            <td align="center">
              <p style="font-size: 11px; color: #86868B; margin: 0;">
                InteliSensor • Segurança e Monitoramento
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