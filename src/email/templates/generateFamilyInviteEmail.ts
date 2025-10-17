export const emailGenerateFamilyInviteEmail = (inviterName: string, patientName: string, inviteCode: string) => `
<!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
        <table role="presentation" style="width: 100%; border-collapse: collapse;">
          <tr>
            <td align="center" style="padding: 40px 0;">
              <table role="presentation" style="width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                <tr>
                  <td style="padding: 40px 40px 20px 40px; text-align: center; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 8px 8px 0 0;">
                    <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: bold;">🏥 InteliSensor</h1>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 40px;">
                    <h2 style="margin: 0 0 20px 0; color: #333333; font-size: 24px;">Você foi convidado! 🎉</h2>
                    <p style="margin: 0 0 20px 0; color: #666666; font-size: 16px; line-height: 1.6;">
                      <strong>${inviterName}</strong> convidou você para acompanhar <strong>${patientName}</strong> no sistema InteliSensor.
                    </p>
                    <table role="presentation" style="width: 100%; border-collapse: collapse; margin: 30px 0;">
                      <tr>
                        <td align="center" style="padding: 30px; background-color: #f8f9fa; border-radius: 8px; border: 2px dashed #667eea;">
                          <p style="margin: 0 0 10px 0; color: #666666; font-size: 14px;">Código do convite</p>
                          <p style="margin: 0; color: #667eea; font-size: 32px; font-weight: bold; letter-spacing: 4px;">${inviteCode}</p>
                        </td>
                      </tr>
                    </table>
                    <p style="margin: 0; color: #666666; font-size: 14px; text-align: center;">
                      © ${new Date().getFullYear()} InteliSensor
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
