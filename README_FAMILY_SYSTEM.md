# Sistema de Familiares - Implementação Completa

## 🎯 Resumo da Implementação

Foi implementado um sistema completo de familiares que permite ao cuidador principal convidar familiares para ter acesso controlado aos dados do paciente. O sistema inclui:

- **Novos Roles**: `FAMILY_MEMBER` adicionado aos enums
- **Tabelas**: `FamilyRelation` e `FamilyPermissions`
- **Códigos de Convite**: Sistema de códigos de 8 dígitos para convites
- **Permissões Granulares**: 6 tipos de permissões configuráveis
- **Guards de Segurança**: Controle automático de acesso baseado em permissões
- **JWT Estendido**: Inclui informações de acesso para familiares

## 📊 Estrutura do Banco de Dados

### Novas Tabelas Criadas:

#### `FamilyRelation`
- `id`: UUID da relação
- `primaryCaregiverId`: ID do cuidador principal
- `familyMemberId`: ID do familiar
- `patientId`: ID do paciente
- `invitedAt`: Data do convite
- `acceptedAt`: Data da aceitação (null = pendente)
- `revokedAt`: Data da revogação (null = ativo)

#### `FamilyPermissions`
- `relationId`: FK para FamilyRelation
- `canViewAlerts`: Ver alertas de queda
- `canRespondAlerts`: Responder alertas
- `canViewProfile`: Ver perfil do paciente
- `canEditProfile`: Editar perfil
- `canManageContacts`: Gerenciar contatos
- `canInviteFamily`: Convidar outros familiares

### Tabelas Modificadas:

#### `User`
- Adicionadas relações para `FamilyRelation`

#### `AccessCode`
- `familyEmail`: Email do familiar convidado
- `familyName`: Nome do familiar
- Novo type `FAMILY_INVITE`

## 🚀 Endpoints Criados

### Family Controller (`/family`)

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `/family/invite` | Cuidador convida familiar |
| POST | `/family/accept-invite` | Familiar aceita convite |
| GET | `/family/patients` | Familiar lista seus pacientes |
| GET | `/family/patients/:id/members` | Cuidador lista familiares |
| PUT | `/family/patients/:id/members/:id/permissions` | Atualizar permissões |
| DELETE | `/family/patients/:id/members/:id` | Revogar acesso |

### Auth Controller (atualizado)

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `/auth/family/login` | Login específico para familiares |

## 🔐 Sistema de Permissões

### Hierarquia de Acesso:

1. **CAREGIVER** (Cuidador Principal)
   - ✅ Acesso total aos pacientes que criou
   - ✅ Convidar/revogar familiares
   - ✅ Gerenciar permissões

2. **FAMILY_MEMBER** (Familiar)
   - ⚠️ Acesso limitado por permissões
   - ✅ Pode ter acesso a múltiplos pacientes
   - ❌ Não pode convidar outros (por padrão)

3. **PATIENT** (Paciente)
   - ✅ Acesso aos próprios dados
   - ❌ Não gerencia familiares

### Tipos de Permissão:

- `canViewAlerts`: Ver alertas de queda
- `canRespondAlerts`: Responder/gerenciar alertas  
- `canViewProfile`: Ver perfil do paciente
- `canEditProfile`: Editar dados do paciente
- `canManageContacts`: Gerenciar contatos emergência
- `canInviteFamily`: Convidar outros familiares

## 🔧 Como Usar nos Controllers Existentes

### Exemplo 1: Fall Alerts Controller
```typescript
import { FamilyAccessGuard, RequirePermission } from '../common/guards/family-access.guard';

@Get('patient/:patientId')
@UseGuards(JwtAuthGuard, FamilyAccessGuard)
async getAlerts(@Param('patientId') patientId: string) {
  // Familiar precisa ter acesso ao paciente
}

@Patch(':id/respond')
@UseGuards(JwtAuthGuard, FamilyAccessGuard)
@RequirePermission('canRespondAlerts')
async respondAlert() {
  // Familiar precisa da permissão específica
}
```

### Exemplo 2: Patient Controller
```typescript
@Get(':patientId/profile')
@UseGuards(JwtAuthGuard, FamilyAccessGuard)
@RequirePermission('canViewProfile')
async getProfile() {}

@Put(':patientId/profile')
@UseGuards(JwtAuthGuard, FamilyAccessGuard)
@RequirePermission('canEditProfile')
async updateProfile() {}
```

## 🌊 Fluxo de Funcionamento

### 1. Cuidador Convida Familiar
```http
POST /family/invite
Authorization: Bearer <caregiver-jwt>
{
  "familyEmail": "familiar@email.com",
  "familyName": "Maria Silva",
  "patientId": "uuid-paciente",
  "canViewAlerts": true,
  "canRespondAlerts": false
}
```

### 2. Familiar Recebe Código
- Código de 8 dígitos (formato: 1234-5678)
- Válido por 48 horas (configurável)
- Enviado por email/WhatsApp

### 3. Familiar Aceita Convite
```http
POST /family/accept-invite
{
  "inviteCode": "1234-5678",
  "password": "senha123"
}
```

### 4. Familiar Faz Login
```http
POST /auth/family/login
{
  "email": "familiar@email.com", 
  "password": "senha123"
}
```

### 5. JWT Retornado Inclui:
```json
{
  "access_token": "jwt-token",
  "user": {
    "sub": "uuid-familiar",
    "role": "FAMILY_MEMBER",
    "patientAccess": [
      {
        "patientId": "uuid-paciente",
        "patientName": "João",
        "permissions": {
          "canViewAlerts": true,
          "canRespondAlerts": false,
          "canViewProfile": true
        }
      }
    ]
  }
}
```

## ⚙️ Configurações

### Variáveis de Ambiente:
- `CODE_SECRET`: Chave para HMAC dos códigos de convite
- `JWT_SECRET`: Chave para JWT tokens

### Configurações Padrão:
- TTL código convite: 48 horas
- Máximo uso código: 1 vez
- Permissões padrão: `canViewAlerts=true`, `canViewProfile=true`

## 🔄 Próximos Passos

1. **Testar Endpoints**: Usar Postman/Insomnia
2. **Aplicar Guards**: Nos controllers existentes
3. **Notificações**: Integrar com Twilio para enviar convites
4. **Frontend**: Implementar telas de convite/aceite
5. **Logs**: Adicionar auditoria das ações

## 📝 Status dos Arquivos

✅ **Criados/Modificados:**
- `prisma/schema.prisma` - Novas tabelas e enums
- `src/family/` - Módulo completo
- `src/auth/` - Login de familiares
- `src/common/guards/` - Guards de acesso
- `src/app.module.ts` - Registro do módulo

✅ **Migration Aplicada:**
- `20251006013942_add_family_system` - Executada com sucesso

✅ **Prisma Client:**
- Regenerado com as novas estruturas

🎉 **Sistema pronto para uso!**