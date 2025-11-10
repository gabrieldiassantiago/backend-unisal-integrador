// auth/dto/login-response.dto.ts
export interface PatientAccess {
  patientId: string;
  patientName: string;
  permissions: {
    canViewAlerts: boolean;
    canRespondAlerts: boolean;
    canViewProfile: boolean;
    canEditProfile: boolean;
    canManageContacts: boolean;
    canInviteFamily: boolean;
  };
}

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  name: string;
  sessionId: string;
  patientAccess?: PatientAccess[];
}

export class LoginResponseDto {
  access_token: string;
  user: JwtPayload;
}
