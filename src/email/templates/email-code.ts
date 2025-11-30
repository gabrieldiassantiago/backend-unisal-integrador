interface EmailCodeVerificationProps {
  code: string;
  userName: string;
}

export const emailCodeVerificationTemplate = ({ code, userName }: EmailCodeVerificationProps) => `
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <meta name="format-detection" content="telephone=no">
  <title>Código de Verificação InteliSensor</title>
  <style type="text/css">
    body { margin: 0; padding: 0; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { border-collapse: collapse; mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; -ms-interpolation-mode: bicubic; }
    p { display: block; margin: 13px 0; }
  </style>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #F5F5F7; color: #1D1D1F;">
  
  <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #F5F5F7;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        
        <table role="presentation" style="max-width: 520px; width: 100%; background-color: #FFFFFF; border-radius: 20px; box-shadow: 0 4px 24px rgba(0, 0, 0, 0.04); overflow: hidden;">
          
          <tr>
            <td align="center" style="padding: 40px 40px 20px 40px;">
              <img src="https://i.imgur.com/JuRCheh.png" alt="InteliSensor" width="280" style="display: block; border: 0; max-width: 100%; object-fit: contain;" />
            </td>
          </tr>
          
          <tr>
            <td style="padding: 0 40px 40px 40px; text-align: center;">
              
              <h1 style="margin: 0 0 12px 0; font-size: 28px; font-weight: 700; color: #1D1D1F; letter-spacing: -0.5px;">
                Verifique seu login
              </h1>
              
              <p style="margin: 0 0 32px 0; font-size: 16px; line-height: 1.5; color: #86868B;">
                Olá, ${userName}. Use o código abaixo para finalizar seu acesso ao <strong>InteliSensor</strong>.
              </p>
              
              <table role="presentation" style="width: 100%; margin: 0 auto;">
                <tr>
                  <td align="center">
                    <div style="background-color: #F5F5F7; border-radius: 12px; padding: 24px; display: inline-block; width: 100%; box-sizing: border-box;">
                      <span style="font-family: 'SF Mono', 'Menlo', 'Monaco', 'Courier New', monospace; font-size: 36px; font-weight: 600; color: #000000; letter-spacing: 6px; display: block;">
                        ${code}
                      </span>
                    </div>
                  </td>
                </tr>
              </table>

              <p style="margin: 24px 0 0 0; font-size: 13px; color: #86868B;">
                Este código expira em 10 minutos.
              </p>

              <div style="height: 1px; background-color: #E5E5EA; margin: 32px 0;"></div>

              <table role="presentation" width="100%">
                <tr>
                  <td align="center">
                    <img src="https://img.icons8.com/ios-glyphs/30/86868b/lock--v1.png" width="16" height="16" alt="lock" style="margin-bottom: 8px; opacity: 0.6;" />
                    <p style="margin: 0; font-size: 12px; color: #86868B; line-height: 1.4; max-width: 300px;">
                      Se você não solicitou este código, não se preocupe. Sua conta está segura e nenhuma ação é necessária.
                    </p>
                  </td>
                </tr>
              </table>

            </td>
          </tr>
          
        </table>
        
        <table role="presentation" style="max-width: 520px; width: 100%; margin-top: 24px;">
          <tr>
            <td align="center">
              <p style="margin: 0; font-size: 11px; color: #86868B; text-align: center;">
                InteliSensor • Monitoramento Inteligente<br>
                Enviado automaticamente pelo sistema.
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