# Backend Unisal Integrador - Sistema de Monitoramento de Quedas

<p align="center">
  <img src="./logo2.svg" width="200" alt="Logo" />
</p>

## 📋 Descrição

Backend do sistema de monitoramento de quedas para idosos desenvolvido como projeto integrador da Unisal. O sistema utiliza dispositivos ESP32 com sensores de movimento (MPU6050) para detectar quedas em tempo real e alertar cuidadores e familiares através de múltiplos canais de comunicação (App, WhatsApp, SMS, chamadas de voz).

## 🎯 Funcionalidades Principais

### 👥 Gerenciamento de Usuários
- **Cuidadores (Caregivers)**: Usuários principais que cadastram e gerenciam pacientes
- **Pacientes**: Pessoas monitoradas pelo sistema, com login simplificado via código
- **Familiares**: Usuários com permissões granulares para acompanhar pacientes específicos

### 🚨 Sistema de Alertas de Queda
- Detecção de quedas via ESP32 com acelerômetro MPU6050
- Notificações instantâneas para cuidadores e familiares autorizados
- Estados de alerta: `PENDING`, `VERIFYING`, `CONFIRMED`, `FALSE_ALARM`, `RESOLVED`, `IGNORED`
- Rastreamento de localização GPS da queda
- Sistema de priorização e resposta de alertas

### 👨‍⚕️ Módulo do Cuidador
- Cadastro de pacientes com pareamento de dispositivo em transação única
- Geração de códigos de acesso simplificados para pacientes (QR Code)
- Gerenciamento de dispositivos ESP32 vinculados
- Renovação de códigos de login

### 👴 Módulo do Paciente
- Login via código simplificado (sem senha complexa)
- Visualização de histórico de quedas
- Acesso ao perfil e informações pessoais

### 👪 Sistema Familiar
- Convite de familiares via email
- Sistema de permissões granulares:
  - Visualizar alertas de queda
  - Responder a alertas
  - Visualizar perfil do paciente
  - Editar perfil
  - Gerenciar contatos de emergência
  - Convidar outros familiares
- Hierarquia: Cuidador Principal → Familiares → Paciente

### 📱 Contatos de Emergência
- Cadastro de contatos prioritários
- Notificação automática via WhatsApp, SMS ou chamada de voz
- Sistema de priorização de contatos
- Confirmação de alertas por contatos de emergência

### 🔧 Gerenciamento de Dispositivos
- Pareamento de dispositivos ESP32 via API Key
- Monitoramento de status dos dispositivos
- Desativação e manutenção de dispositivos
- Rastreamento de última conexão e versão de firmware

### 🔐 Autenticação e Segurança
- JWT (JSON Web Tokens) para autenticação
- Refresh Tokens para sessões persistentes
- Verificação de email via código de 6 dígitos
- Diferentes níveis de acesso (Role-Based Access Control)
- Códigos de acesso temporários com expiração

### 📤 Upload de Arquivos
- Integração com AWS S3 para armazenamento
- Upload de fotos de perfil e documentos
- URLs pré-assinadas para acesso seguro

### 📞 Integração Twilio
- Chamadas de voz para contatos de emergência
- SMS para notificações críticas
- Voice callbacks para confirmação de alertas

## 🏗️ Arquitetura e Stack Tecnológico

### Framework e Runtime
- **NestJS 11**: Framework Node.js progressivo
- **TypeScript 5.7**: Tipagem estática
- **Node.js >= 20.0.0**: Runtime JavaScript

### Banco de Dados
- **PostgreSQL**: Banco de dados principal
- **Prisma 6.13**: ORM moderno com type-safety
- **Redis**: Cache e filas de processamento (via BullMQ)

### Autenticação e Segurança
- **Passport.js**: Middleware de autenticação
- **JWT**: Tokens de autenticação
- **bcrypt**: Hash de senhas

### Comunicação e Notificações
- **Socket.io**: WebSockets para comunicação em tempo real
- **Twilio**: SMS e chamadas de voz
- **Baileys/Whatsapp-web.js**: Integração WhatsApp
- **Nodemailer/Resend/Mailgun**: Envio de emails

### Armazenamento
- **AWS SDK S3**: Upload e storage de arquivos

### Documentação API
- **Swagger/OpenAPI**: Documentação automática
- **Scalar API Reference**: Interface interativa de documentação

### Processamento Assíncrono
- **BullMQ**: Filas de processamento para tarefas assíncronas

### Validação e Transformação
- **class-validator**: Validação de DTOs
- **class-transformer**: Transformação de dados

### Desenvolvimento
- **Jest**: Framework de testes
- **ESLint**: Linting de código
- **Prettier**: Formatação de código
- **SWC**: Compilador rápido TypeScript/JavaScript

## 📁 Estrutura do Projeto

```
backend-unisal-integrador/
├── src/
│   ├── auth/                 # Módulo de autenticação JWT
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts
│   │   ├── auth.module.ts
│   │   ├── jwt-auth.guard.ts
│   │   └── dtos/
│   ├── caregiver/           # Módulo do cuidador
│   │   ├── caregiver.controller.ts
│   │   ├── caregiver.service.ts
│   │   └── dto/
│   ├── patient/             # Módulo do paciente
│   │   ├── patient.controller.ts
│   │   ├── patient.service.ts
│   │   └── dto/
│   ├── family/              # Módulo familiar
│   │   ├── family.controller.ts
│   │   ├── family.service.ts
│   │   └── dtos/
│   ├── fall-alerts/         # Alertas de queda
│   │   ├── fall-alerts.controller.ts
│   │   ├── fall-alerts.service.ts
│   │   └── dtos/
│   ├── devices/             # Dispositivos ESP32
│   │   ├── devices.controller.ts
│   │   ├── devices.service.ts
│   │   └── dtos/
│   ├── emergency-contacts/  # Contatos de emergência
│   │   ├── emergency-contacts.controller.ts
│   │   ├── emergency-contacts.service.ts
│   │   └── dtos/
│   ├── users/               # Gerenciamento de usuários
│   ├── email/               # Serviços de email
│   ├── twilio/              # Integração Twilio (SMS/Voz)
│   ├── upload/              # Upload de arquivos (S3)
│   ├── prisma/              # Serviço Prisma
│   ├── common/              # Utilitários compartilhados
│   ├── errors/              # Tratamento de erros
│   ├── types/               # Definições de tipos
│   ├── app.module.ts        # Módulo raiz
│   └── main.ts              # Ponto de entrada
├── prisma/
│   ├── schema.prisma        # Schema do banco de dados
│   └── migrations/          # Migrações do banco
├── esp32/                   # Código do dispositivo ESP32
│   ├── main.cpp             # Código Arduino/ESP32
│   └── main.py              # Script Python alternativo
├── test/                    # Testes E2E
├── .env                     # Variáveis de ambiente (não versionado)
├── package.json
├── tsconfig.json
└── nest-cli.json
```

## 🗃️ Modelo de Dados (Schema Prisma)

### Principais Entidades

**User** - Usuários do sistema
```prisma
- id: UUID único
- name: Nome completo
- email: Email (único, opcional)
- password: Senha hasheada (opcional)
- role: PATIENT | CAREGIVER | FAMILY_MEMBER
- hasAccount: Boolean (indica se tem conta completa)
- emailVerified: Boolean
- birthDate: Data de nascimento
- gender: MALE | FEMALE | OTHER | UNDECLARED
```

**Device** - Dispositivos ESP32
```prisma
- id: UUID único
- deviceIdentifier: Identificador único do hardware
- apiKeyHash: Hash da chave de API
- status: ACTIVE | INACTIVE | MAINTENANCE | REVOKED
- patientId: Referência ao paciente
- lastSeenAt: Última conexão
- firmwareVersion: Versão do firmware
```

**FallAlert** - Alertas de queda
```prisma
- id: UUID único
- deviceId: Dispositivo que detectou
- patientId: Paciente afetado
- status: PENDING | VERIFYING | CONFIRMED | FALSE_ALARM | RESOLVED | IGNORED
- latitude/longitude: Coordenadas GPS
- respondedBy: Cuidador que respondeu
- confirmedBy: Contato que confirmou
- verificationDeadline: Prazo de verificação
```

**EmergencyContact** - Contatos de emergência
```prisma
- id: UUID único
- name: Nome do contato
- phone: Telefone (único)
- patientId: Paciente associado
- priority: Prioridade de notificação
```

**FamilyRelation** - Relações familiares
```prisma
- primaryCaregiverId: Cuidador principal
- familyMemberId: Familiar convidado
- patientId: Paciente compartilhado
- permissions: Referência às permissões
- invitedAt/acceptedAt: Timestamps de convite
```

**FamilyPermissions** - Permissões de familiares
```prisma
- canViewAlerts: Visualizar alertas
- canRespondAlerts: Responder alertas
- canViewProfile: Ver perfil
- canEditProfile: Editar perfil
- canManageContacts: Gerenciar contatos
- canInviteFamily: Convidar familiares
```

**AccessCode** - Códigos de acesso
```prisma
- codeDigest/codeHash: Código hasheado
- type: LOGIN_PATIENT | DEVICE_PAIRING | FAMILY_INVITE
- caregiverId: Quem gerou
- patientId: Para qual paciente
- expiresAt: Expiração
- maxUses/uses: Controle de uso
```

## 🚀 Instalação e Configuração

### Pré-requisitos

- Node.js >= 20.0.0
- npm >= 10.0.0
- PostgreSQL (ou acesso a um servidor PostgreSQL)
- Redis (para filas BullMQ)
- Conta AWS S3 (para upload de arquivos)
- Conta Twilio (para SMS/chamadas)

### Passos de Instalação

1. **Clone o repositório**
```bash
git clone https://github.com/gabrieldiassantiago/backend-unisal-integrador.git
cd backend-unisal-integrador
```

2. **Instale as dependências**
```bash
npm install
```

3. **Configure as variáveis de ambiente**

Crie um arquivo `.env` na raiz do projeto:

```env
# Database
DATABASE_URL="postgresql://usuario:senha@host:5432/database"

# JWT
JWT_SECRET="sua-chave-secreta-jwt-muito-segura"
JWT_EXPIRES_IN="7d"

# Redis (BullMQ)
REDIS_HOST="localhost"
REDIS_PORT="6379"
REDIS_PASSWORD="senha-redis"

# AWS S3
AWS_REGION="us-east-1"
AWS_ACCESS_KEY_ID="sua-access-key"
AWS_SECRET_ACCESS_KEY="sua-secret-key"
AWS_S3_BUCKET="nome-do-bucket"

# Twilio
TWILIO_ACCOUNT_SID="seu-account-sid"
TWILIO_AUTH_TOKEN="seu-auth-token"
TWILIO_PHONE_NUMBER="+5511999999999"

# Email (escolha um provedor)
# Opção 1: Mailgun
MAILGUN_API_KEY="sua-api-key"
MAILGUN_DOMAIN="seu-dominio.com"

# Opção 2: Resend
RESEND_API_KEY="sua-api-key"

# Opção 3: SMTP genérico
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_USER="seu-email@gmail.com"
SMTP_PASS="sua-senha"

# Application
PORT=3002
NODE_ENV="development"
```

4. **Configure o Prisma e migre o banco de dados**

```bash
# Gerar o cliente Prisma
npx prisma generate

# Executar migrações
npx prisma migrate deploy

# (Opcional) Popular banco com dados iniciais
npx prisma db seed
```

5. **Execute o projeto**

```bash
# Modo desenvolvimento (com hot-reload)
npm run start:dev

# Modo produção
npm run build
npm run start:prod
```

6. **Acesse a documentação da API**

Abra o navegador em: `http://localhost:3002/docs`

## 📡 Endpoints da API

A documentação completa da API está disponível via Swagger em `/docs` quando o servidor está rodando.

### Principais Grupos de Endpoints

#### Autenticação (`/auth`)
- `POST /auth/login` - Login de cuidador
- `POST /auth/family/login` - Login de familiar

#### Cuidador (`/caregiver`)
- `POST /caregiver/patients/with-device` - Criar paciente e parear dispositivo
- `POST /caregiver/patients/:patientId/renew-code` - Renovar código de login

#### Paciente (`/patient`)
- `POST /patient/login-by-code` - Login via código simplificado
- `GET /patient/profile` - Obter perfil do paciente
- `GET /patient/fall-alerts` - Histórico de quedas

#### Alertas de Queda (`/fall-alerts`)
- `POST /fall-alerts` - Criar alerta (ESP32)
- `GET /fall-alerts?patientId=:id` - Listar alertas do paciente
- `PATCH /fall-alerts/:id/verifying` - Marcar como "verificando"
- `PATCH /fall-alerts/:id/false-alarm` - Marcar como falso alarme
- `PATCH /fall-alerts/:id/confirm` - Confirmar alerta

#### Dispositivos (`/devices`)
- `POST /devices/pair` - Parear dispositivo
- `GET /devices/by-user/:userId` - Listar dispositivos do usuário
- `PATCH /devices/deactivate/:deviceId/:userId` - Desativar dispositivo

#### Contatos de Emergência (`/emergency-contacts`)
- `POST /emergency-contacts` - Criar contato
- `GET /emergency-contacts/:patientId` - Listar contatos
- `DELETE /emergency-contacts/:id` - Remover contato

#### Família (`/family`)
- `POST /family/invite` - Convidar familiar
- `POST /family/accept-invite` - Aceitar convite
- `PATCH /family/:relationId/permissions` - Atualizar permissões
- `GET /family/my-patients` - Listar pacientes acessíveis

#### Upload (`/upload`)
- `POST /upload` - Fazer upload de arquivo
- `GET /upload/:key` - Obter URL assinada do arquivo

#### Usuários (`/users`)
- `POST /users/register` - Registrar novo usuário
- `POST /users/verify-email` - Verificar código de email
- `GET /users/profile` - Obter perfil do usuário

## 🤖 Integração ESP32

O sistema suporta dispositivos ESP32 com sensores MPU6050 para detecção de quedas.

### Hardware Necessário
- ESP32 DevKit
- Sensor MPU6050 (Acelerômetro/Giroscópio)
- Conexão WiFi

### Código de Exemplo

O código está disponível em `/esp32/main.cpp`:

```cpp
// Detecta queda quando aceleração Y > 18 m/s²
if(a.acceleration.y > 18) {
  // Envia POST para /fall-alerts
  String jsonPayload = {
    "serial": "DEV-00000",
    "apiKey": "api-key-00000-1759262700148",
    "latitude": -23.5505,
    "longitude": -46.6333,
    "timestamp": "2024-01-15T10:30:00Z"
  };
}
```

### Fluxo de Pareamento
1. Cuidador cria dispositivo via `/devices/pair`
2. Sistema gera `deviceIdentifier` e `apiKey`
3. ESP32 usa credenciais para enviar alertas
4. Backend valida apiKey e associa ao paciente

### Endpoint para ESP32
```
POST /fall-alerts
Content-Type: application/json

{
  "serial": "DEV-12345",
  "apiKey": "sua-api-key-gerada",
  "latitude": -23.5505,
  "longitude": -46.6333,
  "timestamp": "2025-01-15T10:30:00Z"
}
```

## 🧪 Testes

```bash
# Testes unitários
npm run test

# Testes E2E
npm run test:e2e

# Cobertura de testes
npm run test:cov

# Modo watch (desenvolvimento)
npm run test:watch
```

## 🔍 Linting e Formatação

```bash
# Executar ESLint
npm run lint

# Formatar código com Prettier
npm run format
```

## 📦 Build e Deploy

### Build para Produção

```bash
npm run build
```

Os arquivos compilados estarão em `/dist`

### Executar em Produção

```bash
npm run start:prod
```

### Variáveis de Ambiente para Produção

Certifique-se de configurar:
- `NODE_ENV=production`
- `DATABASE_URL` com conexão SSL se necessário
- `JWT_SECRET` forte e único
- Todas as credenciais de serviços externos

### Docker (Opcional)

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npx prisma generate
RUN npm run build
EXPOSE 3002
CMD ["npm", "run", "start:prod"]
```

## 🔐 Segurança

### Boas Práticas Implementadas

- **Senhas**: Hash com bcrypt (salt rounds: 10)
- **JWT**: Tokens com expiração configurável
- **Refresh Tokens**: Para sessões persistentes
- **API Keys**: Hasheadas no banco de dados
- **Códigos de Acesso**: Temporários com limite de tentativas
- **Validação**: DTOs validados com class-validator
- **CORS**: Habilitado com configuração adequada
- **Verificação de Email**: Código de 6 dígitos

### Recomendações Adicionais

- Use HTTPS em produção
- Configure rate limiting
- Implemente logs de auditoria
- Monitore tentativas de acesso suspeitas
- Rotacione secrets regularmente

## 📊 Monitoramento e Logs

O sistema utiliza **Pino** para logging estruturado:

```typescript
// Logs são automaticamente formatados em JSON
logger.info('Fall alert created', { alertId, patientId });
logger.error('Failed to send notification', { error, contactId });
```

### Níveis de Log
- `error`: Erros críticos
- `warn`: Avisos
- `info`: Informações gerais
- `debug`: Debug detalhado

## 🤝 Contribuindo

1. Fork o projeto
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

### Convenções de Código

- Use TypeScript com tipagem forte
- Siga os padrões ESLint/Prettier configurados
- Escreva testes para novas funcionalidades
- Documente endpoints com decorators Swagger
- Use commits semânticos (feat, fix, docs, etc.)

## 📝 Licença

Este projeto está sob a licença MIT.

## 👨‍💻 Autores

- **Gabriel Dias Santiago** - Desenvolvimento Backend
- **Equipe Magros** - Projeto Integrador Unisal

## 📞 Suporte

Para questões e suporte:
- Email: magros@gab.com
- Issues: [GitHub Issues](https://github.com/gabrieldiassantiago/backend-unisal-integrador/issues)

## 🙏 Agradecimentos

- Universidade Salesiana (Unisal)
- Professores orientadores
- Comunidade NestJS
- Comunidade Open Source

---

**Desenvolvido com ❤️ para tornar a vida dos idosos mais segura**
