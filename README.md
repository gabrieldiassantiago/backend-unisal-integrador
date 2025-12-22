# Documentação Técnica - InteliSensor Backend

## 📝 Visão Geral
O **InteliSensor** é um ecossistema de monitoramento de quedas voltado para o cuidado de idosos e pacientes. O sistema integra hardware (ESP32 com acelerômetro) e software (Backend NestJS) para detectar quedas e acionar alertas multicanais em tempo real para cuidadores e familiares.

---

## 🛠️ Stack Tecnológica

### Backend
- **Framework:** NestJS (v11+)
- **Linguagem:** TypeScript
- **Banco de Dados:** PostgreSQL
- **ORM:** Prisma
- **Mensageria/Filas:** Redis + BullMQ (para processamento assíncrono de alertas)
- **Documentação API:** Swagger (OpenAPI) + Scalar
- **Autenticação:** JWT com Passport.js

### Hardware (Folder: `/esp32`)
- **Microcontrolador:** ESP32
- **Sensor:** MPU6050 (Acelerômetro e Giroscópio)
- **Linguagens:** MicroPython e C++ (Arduino IDE)

### Integrações Externas
- **WhatsApp:** Evolution API / Messaging Service
- **Voz/SMS:** Twilio & Infobip
- **Geocoding:** GeoApify (Conversão de coordenadas em endereços)
- **Email:** Mailgun, Resend e Nodemailer
- **Notificações Push:** Expo Server SDK

---

## 📂 Estrutura de Pastas

```text
├── src/
│   ├── auth/              # Gestão de tokens e segurança
│   ├── caregiver/         # Lógica específica para cuidadores
│   ├── devices/           # Monitoramento e pareamento de dispositivos
│   ├── email/             # Templates e serviços de envio de email
│   ├── emergency-contacts/# Gestão de contatos de emergência (SMS/Voz)
│   ├── fall-alerts/       # Núcleo do sistema de alertas (detecção e resposta)
│   ├── family/            # Gestão de relações familiares e permissões
│   ├── messaging/         # Integração com WhatsApp (Evolution API)
│   ├── patient/           # Gestão de perfis monitorados
│   ├── prisma/            # Cliente e esquemas do banco de dados
│   ├── users/             # Gestão de usuários e verificação de email
│   └── webhook/           # Recebimento de callbacks de serviços externos
├── esp32/                 # Firmware do dispositivo de detecção
├── prisma/                # Migrations e schema.prisma
└── test/                  # Testes unitários e e2e
```

---

## ⚙️ Funcionalidades Principais

### 1. Sistema de Alertas de Queda (`src/fall-alerts`)
- **Detecção:** Recebe inputs do ESP32 via HTTP POST.
- **Processamento:** Inicia uma fila de alertas no BullMQ.
- **Escalabilidade de Contatos:** Aciona o "Contato Prioritário 1" e, caso não haja resposta, escala para os demais.
- **Multi-canal:** Notificação via Push (App), WhatsApp, Chamada de Voz e SMS.
- **Gestão de Status:**
  - `PENDING`: Alerta recebido, aguardando resposta.
  - `VERIFYING`: Cuidador indicou que está indo verificar.
  - `CONFIRMED`: Emergência confirmada.
  - `FALSE_ALARM`: Marcado como erro de detecção.
  - `RESOLVED`: Situação finalizada.

### 2. Gestão de Usuários e Relações (`src/users`, `src/family`)
- **Cadastro Simples:** Registro seguido de verificação de email (OTP).
- **Hierarquia de Relações:**
  - **Cuidador (Caregiver):** Responsável principal pelo paciente.
  - **Paciente (Patient):** Quem utiliza o dispositivo.
  - **Família (Family Member):** Pode visualizar status e receber alertas dependendo das permissões.

### 3. Monitoramento de Dispositivos (`src/devices`)
- **Status Online/Offline:** Monitoramento via heartbeat.
- **Nível de Bateria:** Alertas de bateria fraca para o cuidador.
- **Pareamento:** Protocolo de segurança para vincular hardware a um paciente.

---

## 🗄️ Modelo de Dados (Prisma)
Os principais modelos incluem:
- `User`: Centraliza Caregivers, Patients e Family Members.
- `Device`: Dados técnicos do hardware vinculado.
- `FallAlert`: Registro histórico de cada incidente.
- `EmergencyContact`: Lista de contatos externos para SMS/Voz.
- `FamilyRelation`: Matriz de permissões entre familiares.

---

## 🚀 Como Executar

### Pré-requisitos
- Node.js (v20+)
- PostgreSQL
- Redis

### Instalação
1. Clone o repositório
2. Instale as dependências:
   ```bash
   npm install
   ```
3. Configure o arquivo `.env` com as credenciais (DB, Redis, API Keys).
4. Rode as migrations:
   ```bash
   npx prisma migrate dev
   ```
5. Inicie o servidor:
   ```bash
   npm run start:dev
   ```

### Documentação da API
Após iniciar o servidor, acesse:
- **Swagger UI:** `http://localhost:3000/api`
- **Scalar Reference:** `http://localhost:3000/reference`

---

## 🛡️ Segurança
- Senhas criptografadas com **Bcrypt** (salt de 10-12 rounds).
- Autenticação via **JWT** (JSON Web Tokens).
- Proteção de rotas com **Guards** específicos (Admin, Caregiver, etc.).
- Sanitização de inputs com **Class Validator**.

---

## 📡 Hardware (ESP32)
O firmware lê o acelerômetro `MPU6050`. Uma queda é detectada quando a aceleração resultante cruza um limite pré-definido.
- **Configuração:** O arquivo `esp32/main.py` (ou `main.cpp`) deve ser configurado com o `DEVICE_SERIAL` e a `API_KEY` gerada no backend.
- **Conectividade:** Utiliza WiFi para enviar o payload JSON para o endpoint `/fall-alerts`.
