import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Configuração do Swagger a doc
  const config = new DocumentBuilder()
    .setTitle('Backend Unisal Integrador API')
    .setDescription('API para sistema de monitoramento de quedas com integração WhatsApp')
    .setVersion('1.0')
    .addTag('whatsapp', 'Operações relacionadas ao WhatsApp')
    .build();

  
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);
  
await app.listen(3002, '0.0.0.0');
}
bootstrap();