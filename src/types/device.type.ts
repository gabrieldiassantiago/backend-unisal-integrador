export type DeviceStatus = 'ACTIVE' | 'INACTIVE';

export interface Device {
    id: string;
    deviceIdentifier: string;
    patientId: string;
    status: DeviceStatus;
    registeredAt: Date;
}

