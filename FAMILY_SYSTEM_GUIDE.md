# Exemplos de Uso dos Guards de Família

## Como usar FamilyAccessGuard nos controllers existentes

### 1. Fall Alerts Controller

```typescript
import { FamilyAccessGuard, RequirePermission } from '../common/guards/family-access.guard';
import { CurrentUserWithFamily } from '../common/decorators/current-user-with-family.decorator';

// Listar alertas (todos podem ver se têm acesso ao paciente)
@Get('patient/:patientId')
@UseGuards(JwtAuthGuard, FamilyAccessGuard)
async getAlertsByPatient(@Param('patientId') patientId: string) {
  return this.fallAlertsService.getAlertsByPatient(patientId);
}

// Responder alerta (só quem tem permissão canRespondAlerts)
@Patch(':alertId/respond')
@UseGuards(JwtAuthGuard, FamilyAccessGuard)
@RequirePermission('canRespondAlerts')
async respondToAlert(@Param('alertId') alertId: string, @Body() dto: RespondAlertDto) {
  return this.fallAlertsService.respondToAlert(alertId, dto);
}
```

### 2. Patient Controller

```typescript
// Ver perfil (todos podem ver se têm permissão canViewProfile)
@Get(':patientId/profile')
@UseGuards(JwtAuthGuard, FamilyAccessGuard)
@RequirePermission('canViewProfile')
async getPatientProfile(@Param('patientId') patientId: string) {
  return this.patientService.getProfile(patientId);
}

// Editar perfil (só quem tem permissão canEditProfile)
@Put(':patientId/profile')
@UseGuards(JwtAuthGuard, FamilyAccessGuard)
@RequirePermission('canEditProfile')
async updatePatientProfile(
  @Param('patientId') patientId: string,
  @Body() dto: UpdatePatientDto
) {
  return this.patientService.updateProfile(patientId, dto);
}
```

### 3. Emergency Contacts Controller

```typescript
// Listar contatos (todos podem ver se têm acesso ao paciente)
@Get('patient/:patientId')
@UseGuards(JwtAuthGuard, FamilyAccessGuard)
async getContactsByPatient(@Param('patientId') patientId: string) {
  return this.emergencyContactsService.getByPatient(patientId);
}

// Gerenciar contatos (só quem tem permissão canManageContacts)
@Post('patient/:patientId')
@UseGuards(JwtAuthGuard, FamilyAccessGuard)
@RequirePermission('canManageContacts')
async createContact(
  @Param('patientId') patientId: string,
  @Body() dto: CreateEmergencyContactDto
) {
  return this.emergencyContactsService.createContact({
    ...dto,
    patientId
  });
}
```

## Fluxo de Funcionamento

### 1. Cuidador Principal Convida Familiar
```
POST /family/invite
Authorization: Bearer <caregiver-jwt>
{
  "familyEmail": "familiar@email.com",
  "familyName": "Maria Silva",
  "patientId": "uuid-paciente",
  "canViewAlerts": true,
  "canRespondAlerts": false,
  "canViewProfile": true
}

Resposta:
{
  "inviteCode": "1234-5678",
  "expiresAt": "2025-10-07T10:30:00Z",
  "familyMember": {
    "id": "uuid-familiar",
    "name": "Maria Silva",
    "email": "familiar@email.com"
  }
}
```

### 2. Familiar Aceita Convite
```
POST /family/accept-invite
{
  "inviteCode": "1234-5678",
  "password": "senha123"
}

Resposta:
{
  "accessToken": "jwt-token",
  "user": {
    "sub": "uuid-familiar",
    "email": "familiar@email.com",
    "role": "FAMILY_MEMBER",
    "name": "Maria Silva"
  },
  "permissions": {...}
}
```

### 3. Familiar Faz Login
```
POST /auth/family/login
{
  "email": "familiar@email.com",
  "password": "senha123"
}

Resposta:
{
  "access_token": "jwt-com-patient-access",
  "user": {
    "sub": "uuid-familiar",
    "role": "FAMILY_MEMBER",
    "patientAccess": [
      {
        "patientId": "uuid-paciente",
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

### 4. Familiar Acessa Dados
```
GET /fall-alerts/patient/uuid-paciente
Authorization: Bearer <family-jwt>

// FamilyAccessGuard verifica:
// 1. Familiar tem acesso ao paciente
// 2. Se endpoint tem @RequirePermission, verifica permissão específica
```

## Permissões Disponíveis

- `canViewAlerts`: Ver alertas de queda
- `canRespondAlerts`: Responder/gerenciar alertas
- `canViewProfile`: Ver perfil do paciente
- `canEditProfile`: Editar perfil do paciente
- `canManageContacts`: Gerenciar contatos de emergência
- `canInviteFamily`: Convidar outros familiares

## Hierarquia de Acesso

1. **CAREGIVER** (Cuidador Principal)
   - Acesso total a todos os pacientes que criou
   - Pode convidar familiares
   - Pode gerenciar permissões dos familiares

2. **FAMILY_MEMBER** (Familiar)
   - Acesso limitado conforme permissões
   - Pode ver múltiplos pacientes se convidado para vários
   - Não pode convidar outros familiares (a menos que tenha permissão)

3. **PATIENT** (Paciente)
   - Acesso apenas aos próprios dados
   - Não pode convidar familiares