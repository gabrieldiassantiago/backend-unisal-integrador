# Documentação de Testes - Sistema de Familiares

## 📋 Índice

1. [Configuração Inicial](#configuração-inicial)
2. [Fluxo Completo de Teste](#fluxo-completo-de-teste)
3. [Endpoints Disponíveis](#endpoints-disponíveis)
4. [Testes por Funcionalidade](#testes-por-funcionalidade)
5. [Exemplos de Requisições](#exemplos-de-requisições)

---

## 🚀 Configuração Inicial

### Pré-requisitos

- Backend rodando em `http://localhost:3002`
- Token JWT válido de um cuidador principal
- Paciente cadastrado
- Ferramenta para fazer requisições HTTP (Postman, Insomnia, curl, etc.)

### Variáveis de Ambiente

Certifique-se de que estas variáveis estão configuradas:
- `JWT_SECRET`
- `CODE_SECRET`
- `DATABASE_URL`

---

## 📝 Fluxo Completo de Teste

### Passo a Passo

1. **Criar Paciente** (como cuidador principal)
2. **Convidar Familiar** (cuidador gera código)
3. **Aceitar Convite** (familiar cria conta)
4. **Verificar Família Completa**
5. **Testar Recebimento de Alertas**
6. **Testar Resposta a Alertas**

---

## 🔗 Endpoints Disponíveis

### Endpoints de Familiares

| Método | Endpoint | Descrição | Autenticação |
|--------|----------|-----------|--------------|
| POST | `/family/invite` | Cuidador convida familiar | ✅ JWT (CAREGIVER) |
| POST | `/family/accept-invite` | Familiar aceita convite | ❌ Público |
| GET | `/family/patients` | Familiar lista seus pacientes | ✅ JWT (FAMILY_MEMBER) |
| GET | `/family/patients/:patientId/members` | Listar familiares de um paciente | ✅ JWT (CAREGIVER) |
| GET | `/family/patients/:patientId/full-family` | **NOVO** - Ver família completa | ✅ JWT |
| PUT | `/family/patients/:patientId/members/:familyMemberId/permissions` | Atualizar permissões | ✅ JWT (CAREGIVER) |
| DELETE | `/family/patients/:patientId/members/:familyMemberId` | Revogar acesso | ✅ JWT (CAREGIVER) |

### Endpoints de Cuidadores

| Método | Endpoint | Descrição | Autenticação |
|--------|----------|-----------|--------------|
| GET | `/caregiver/patients` | **NOVO** - Listar pacientes com familiares | ✅ JWT (CAREGIVER) |

### Endpoints de Alertas

| Método | Endpoint | Descrição | Autenticação |
|--------|----------|-----------|--------------|
| POST | `/fall-alerts` | Criar alerta (via dispositivo) | ❌ API Key |
| POST | `/fall-alerts/:alertId/false-alarm` | Marcar como falso alarme | ✅ JWT |
| POST | `/fall-alerts/:alertId/verifying` | Marcar como verificando | ✅ JWT |
| POST | `/fall-alerts/:alertId/confirm` | Confirmar após verificação | ✅ JWT |

---

## 🧪 Testes por Funcionalidade

### 1. Convidar Familiar

**Endpoint:** `POST /family/invite`

**Headers:**
```
Authorization: Bearer {token_do_cuidador}
Content-Type: application/json
```

**Body:**
```json
{
  "email": "familiar@example.com",
  "name": "João Silva",
  "patientId": "uuid-do-paciente",
  "ttlHours": 48,
  "canViewAlerts": true,
  "canRespondAlerts": false,
  "canViewProfile": true,
  "canEditProfile": false,
  "canManageContacts": false,
  "canInviteFamily": false
}
```

**Resposta Esperada:**
```json
{
  "inviteCode": "1234-5678",
  "expiresAt": "2025-01-20T10:00:00.000Z",
  "familyMember": {
    "id": "uuid",
    "name": "João Silva",
    "email": "familiar@example.com"
  },
  "patient": {
    "id": "uuid-do-paciente",
    "name": "Maria Silva"
  }
}
```

**Teste no Postman/Insomnia:**
```
POST http://localhost:3002/family/invite
Authorization: Bearer {seu_token}
Content-Type: application/json

{
  "email": "familiar@example.com",
  "name": "João Silva",
  "patientId": "SEU_PATIENT_ID_AQUI",
  "canViewAlerts": true,
  "canRespondAlerts": true
}
```

---

### 2. Aceitar Convite do Familiar

**Endpoint:** `POST /family/accept-invite`

**Body:**
```json
{
  "inviteCode": "1234-5678",
  "password": "senha123"
}
```

**Resposta Esperada:**
```json
{
  "accessToken": "jwt_token_do_familiar",
  "user": {
    "sub": "uuid-do-familiar",
    "email": "familiar@example.com",
    "role": "FAMILY_MEMBER",
    "name": "João Silva"
  },
  "patient": {
    "id": "uuid-do-paciente",
    "name": "Maria Silva"
  },
  "permissions": {
    "canViewAlerts": true,
    "canRespondAlerts": false,
    "canViewProfile": true,
    "canEditProfile": false,
    "canManageContacts": false,
    "canInviteFamily": false
  }
}
```

**Teste:**
```
POST http://localhost:3002/family/accept-invite
Content-Type: application/json

{
  "inviteCode": "1234-5678",
  "password": "senha123"
}
```

---

### 3. Familiar Ver Seus Pacientes

**Endpoint:** `GET /family/patients`

**Headers:**
```
Authorization: Bearer {token_do_familiar}
```

**Resposta Esperada:**
```json
[
  {
    "id": "uuid-do-paciente",
    "name": "Maria Silva",
    "birthDate": "1950-01-01T00:00:00.000Z",
    "gender": "FEMALE",
    "age": 75,
    "permissions": {
      "canViewAlerts": true,
      "canRespondAlerts": true,
      "canViewProfile": true,
      "canEditProfile": false,
      "canManageContacts": false,
      "canInviteFamily": false
    }
  }
]
```

**Teste:**
```
GET http://localhost:3002/family/patients
Authorization: Bearer {token_do_familiar}
```

---

### 4. Ver Família Completa de um Paciente

**Endpoint:** `GET /family/patients/:patientId/full-family`

**Headers:**
```
Authorization: Bearer {token_do_cuidador_ou_familiar}
```

**Resposta Esperada:**
```json
{
  "patient": {
    "id": "uuid-do-paciente",
    "name": "Maria Silva",
    "birthDate": "1950-01-01T00:00:00.000Z",
    "gender": "FEMALE",
    "email": null,
    "createdAt": "2025-01-01T00:00:00.000Z",
    "age": 75
  },
  "primaryCaregiver": {
    "id": "uuid-do-cuidador",
    "name": "Pedro Silva",
    "email": "pedro@example.com",
    "role": "CAREGIVER",
    "createdAt": "2025-01-01T00:00:00.000Z",
    "relationId": "uuid-da-relacao",
    "relationCreatedAt": "2025-01-01T00:00:00.000Z"
  },
  "familyMembers": [
    {
      "id": "uuid-do-familiar",
      "name": "João Silva",
      "email": "familiar@example.com",
      "role": "FAMILY_MEMBER",
      "hasAccount": true,
      "createdAt": "2025-01-15T00:00:00.000Z",
      "invitedAt": "2025-01-15T00:00:00.000Z",
      "acceptedAt": "2025-01-15T10:00:00.000Z",
      "status": "accepted",
      "invitedBy": {
        "id": "uuid-do-cuidador",
        "name": "Pedro Silva",
        "email": "pedro@example.com"
      },
      "permissions": {
        "canViewAlerts": true,
        "canRespondAlerts": true,
        "canViewProfile": true,
        "canEditProfile": false,
        "canManageContacts": false,
        "canInviteFamily": false
      }
    }
  ]
}
```

**Teste:**
```
GET http://localhost:3002/family/patients/{patientId}/full-family
Authorization: Bearer {token}
```

---

### 5. Cuidador Ver Todos os Pacientes com Familiares

**Endpoint:** `GET /caregiver/patients`

**Headers:**
```
Authorization: Bearer {token_do_cuidador}
```

**Resposta Esperada:**
```json
[
  {
    "id": "uuid-do-paciente-1",
    "name": "Maria Silva",
    "birthDate": "1950-01-01T00:00:00.000Z",
    "gender": "FEMALE",
    "email": null,
    "hasAccount": false,
    "createdAt": "2025-01-01T00:00:00.000Z",
    "age": 75,
    "relationId": "uuid",
    "relationCreatedAt": "2025-01-01T00:00:00.000Z",
    "familyMembers": [
      {
        "id": "uuid-do-familiar",
        "name": "João Silva",
        "email": "familiar@example.com",
        "role": "FAMILY_MEMBER",
        "hasAccount": true,
        "createdAt": "2025-01-15T00:00:00.000Z",
        "invitedAt": "2025-01-15T00:00:00.000Z",
        "acceptedAt": "2025-01-15T10:00:00.000Z",
        "status": "accepted",
        "permissions": {
          "canViewAlerts": true,
          "canRespondAlerts": true,
          "canViewProfile": true,
          "canEditProfile": false,
          "canManageContacts": false,
          "canInviteFamily": false
        }
      }
    ]
  }
]
```

**Teste:**
```
GET http://localhost:3002/caregiver/patients
Authorization: Bearer {token_do_cuidador}
```

---

### 6. Testar Recebimento de Alertas por Familiares

#### 6.1 Criar Alerta (simulado)

Você pode criar um alerta via dispositivo ou usar o endpoint da API. O importante é que o sistema agora buscará tanto cuidadores quanto familiares para enviar push notifications.

**Verificar se funcionou:**

1. Crie um alerta para um paciente
2. Verifique os logs do backend - você deve ver tokens sendo buscados de cuidadores E familiares
3. Familiares com `canViewAlerts: true` devem receber notificação push

#### 6.2 WebSocket - Familiares Recebendo Eventos

**Como testar:**

1. Conecte ao WebSocket: `ws://localhost:3002/ws/fall-alerts`
2. Faça join na sala do paciente:
```json
{
  "event": "joinPatient",
  "data": "uuid-do-paciente"
}
```

3. Quando um alerta for criado, você deve receber o evento `newAlert`

**Exemplo com JavaScript:**
```javascript
const io = require('socket.io-client');
const socket = io('http://localhost:3002/fall-alerts', {
  path: '/ws/fall-alerts'
});

socket.emit('joinPatient', 'uuid-do-paciente');

socket.on('newAlert', (alert) => {
  console.log('Novo alerta recebido:', alert);
});
```

---

### 7. Testar Resposta a Alertas por Familiares

#### 7.1 Marcar como Falso Alarme

**Endpoint:** `POST /fall-alerts/:alertId/false-alarm`

**Headers:**
```
Authorization: Bearer {token_do_familiar}
```

**Teste:**
```
POST http://localhost:3002/fall-alerts/{alertId}/false-alarm
Authorization: Bearer {token_do_familiar}
```

**Cenários:**
- ✅ Familiar com `canRespondAlerts: true` → Deve funcionar
- ❌ Familiar com `canRespondAlerts: false` → Deve retornar 403 Forbidden

#### 7.2 Marcar como Verificando

**Endpoint:** `POST /fall-alerts/:alertId/verifying`

```
POST http://localhost:3002/fall-alerts/{alertId}/verifying
Authorization: Bearer {token_do_familiar}
```

#### 7.3 Confirmar Após Verificação

**Endpoint:** `POST /fall-alerts/:alertId/confirm`

```
POST http://localhost:3002/fall-alerts/{alertId}/confirm
Authorization: Bearer {token_do_familiar}
```

---

## 📋 Checklist de Testes

### Funcionalidades Básicas

- [ ] Cuidador consegue gerar código de convite
- [ ] Familiar consegue aceitar convite e criar conta
- [ ] Familiar consegue ver seus pacientes
- [ ] Cuidador consegue ver família completa de um paciente
- [ ] Cuidador consegue listar todos os pacientes com familiares

### Alertas e Notificações

- [ ] Familiares recebem push notifications quando alerta é criado (se `canViewAlerts: true`)
- [ ] Familiares recebem eventos WebSocket quando alerta é criado
- [ ] Familiares conseguem fazer join na sala WebSocket do paciente

### Permissões

- [ ] Familiar com `canRespondAlerts: true` consegue responder alertas
- [ ] Familiar com `canRespondAlerts: false` NÃO consegue responder alertas (retorna 403)
- [ ] Cuidadores principais sempre conseguem responder alertas

### Validações

- [ ] Tentar acessar paciente sem permissão retorna 403
- [ ] Tentar responder alerta sem permissão retorna 403
- [ ] Código de convite expirado não funciona
- [ ] Código de convite já usado não funciona

---

## 🐛 Troubleshooting

### Problema: Familiar não recebe push notification

**Solução:**
1. Verifique se o familiar tem `canViewAlerts: true` nas permissões
2. Verifique se a relação familiar está ativa (`acceptedAt` não nulo, `revokedAt` nulo)
3. Verifique se o familiar tem um `pushToken` cadastrado
4. Verifique os logs do backend ao criar alerta

### Problema: Familiar não consegue responder alerta

**Solução:**
1. Verifique se o familiar tem `canRespondAlerts: true`
2. Verifique se está usando o token correto do familiar
3. Verifique se o alerta ainda está com status `PENDING`

### Problema: WebSocket não está recebendo eventos

**Solução:**
1. Verifique se fez join na sala correta: `patient_{patientId}`
2. Verifique se o alerta está sendo criado para o paciente correto
3. Verifique os logs do gateway no backend

---

## 📚 Recursos Adicionais

### Swagger/OpenAPI

Acesse a documentação interativa em:
```
http://localhost:3002/docs
```

### Logs do Backend

Os logs mostram:
- Quando push tokens são buscados
- Quando familiares são incluídos nas notificações
- Quando permissões são verificadas
- Erros de permissão (403)

---

## 💡 Exemplos de Scripts de Teste

### Script Node.js para Testar WebSocket

```javascript
const io = require('socket.io-client');

const socket = io('http://localhost:3002', {
  path: '/ws/fall-alerts',
  transports: ['websocket']
});

socket.on('connect', () => {
  console.log('✅ Conectado ao WebSocket');
  socket.emit('joinPatient', 'SEU_PATIENT_ID');
});

socket.on('newAlert', (alert) => {
  console.log('🚨 Novo alerta:', alert);
});

socket.on('alertStatusChanged', (data) => {
  console.log('🔄 Status mudou:', data);
});

socket.on('requestConfirmation', (data) => {
  console.log('🔔 Solicitação de confirmação:', data);
});
```

### Script cURL para Testar Fluxo Completo

```bash
# 1. Obter token do cuidador (faça login primeiro)
CAREGIVER_TOKEN="seu_token_aqui"

# 2. Criar convite
curl -X POST http://localhost:3002/family/invite \
  -H "Authorization: Bearer $CAREGIVER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "familiar@test.com",
    "name": "Familiar Teste",
    "patientId": "uuid-do-paciente",
    "canViewAlerts": true,
    "canRespondAlerts": true
  }'

# 3. Aceitar convite (use o código retornado)
curl -X POST http://localhost:3002/family/accept-invite \
  -H "Content-Type: application/json" \
  -d '{
    "inviteCode": "1234-5678",
    "password": "senha123"
  }'

# 4. Ver pacientes como familiar
FAMILY_TOKEN="token_retornado_no_passo_3"
curl -X GET http://localhost:3002/family/patients \
  -H "Authorization: Bearer $FAMILY_TOKEN"

# 5. Ver família completa
curl -X GET http://localhost:3002/family/patients/{patientId}/full-family \
  -H "Authorization: Bearer $CAREGIVER_TOKEN"
```

---

## ✅ Conclusão

Com esta documentação, você pode testar todas as funcionalidades implementadas do sistema de familiares. Se encontrar algum problema, verifique os logs do backend e as permissões configuradas.

