export class FamilyMemberResponseDto {
  id: string;
  name: string;
  email: string;
  acceptedAt: Date | null;
  invitedAt: Date;
  permissions: {
    canViewAlerts: boolean;
    canRespondAlerts: boolean;
    canViewProfile: boolean;
    canEditProfile: boolean;
    canManageContacts: boolean;
    canInviteFamily: boolean;
  };
}

export class FamilyPatientResponseDto {
  id: string;
  name: string;
  birthDate: Date | null;
  gender: string | null;
  age: number | null;
  permissions: {
    canViewAlerts: boolean;
    canRespondAlerts: boolean;
    canViewProfile: boolean;
    canEditProfile: boolean;
    canManageContacts: boolean;
    canInviteFamily: boolean;
  };
}