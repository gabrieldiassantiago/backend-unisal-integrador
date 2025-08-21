import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { apiReference } from '@scalar/nestjs-api-reference'
import { ValidationPipe } from '@nestjs/common'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)

  app.enableCors()
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }))

  // Documentação OpenAPI
  const config = new DocumentBuilder()
    .setTitle('Backend Unisal Integrador API')
    .setDescription(
      'API para sistema de monitoramento de quedas com integração WhatsApp. ' +
        'Endpoints organizados por módulos: auth, patient, fall-alerts, emergency-contacts, devices, whatsapp, users, caregiver.',
    )
    .setVersion('1.0.0')
    .setContact('criado por magros', 'https://example.com', 'magros@gab.com')
    .setLicense('MIT', 'https://opensource.org/licenses/MIT')
    .addServer('http://localhost:3002', 'Local dev')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Insira o token JWT com "Bearer <token>"',
      },
      'JWT', 
    )
    .addTag('auth', 'Autenticação e tokens')
    .addTag('patient', 'Operações do paciente')
    .addTag('fall-alerts', 'Alertas de queda')
    .addTag('emergency-contacts', 'Contatos de emergência')
    .addTag('devices', 'Dispositivos')
    .addTag('whatsapp', 'Integração WhatsApp')
    .addTag('users', 'Gerenciamento de usuários')
    .addTag('caregiver', 'Operações do cuidador')
    .build()

  const document = SwaggerModule.createDocument(app, config, {

  })

  app.use(
    '/docs',
    apiReference({
      content: document,
      theme: 'moon',
    }),
  )

  await app.listen(3002, '0.0.0.0')
}
bootstrap()
