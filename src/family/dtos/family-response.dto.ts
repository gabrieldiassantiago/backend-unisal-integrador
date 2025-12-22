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
  fallAlerts: {
    id: string;
    createdAt: Date;
    updatedAt: Date;
    type: string;
    location: string;
    severity: string;
    caregiverId: string;
    patientId: string;
    status: string;
    caregiver: {
      id: string;
      name: string;
      email: string;
    };
    patient: {
      id: string;
      name: string;
      birthDate: Date | null;
      gender: string | null;
      age: number | null;
    };
  }[];
}