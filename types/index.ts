export type UserRole = 'ADMIN' | 'DRIVER' | 'CITIZEN';

export interface BaseUser {
  id: string;
  name: string;
  role: UserRole;
}

export interface Citizen extends BaseUser {
  role: 'CITIZEN';
  barangay: string;
  address: string;
  houseLotNumber: string;
}

export interface Driver extends BaseUser {
  role: 'DRIVER';
  truckPlateNumber: string;
  assignedRouteId?: string;
}