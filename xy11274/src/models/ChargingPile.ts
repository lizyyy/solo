import { BaseEntity, LockStatus } from './types';

export interface ChargingPile extends BaseEntity {
  code: string;
  name: string;
  status: 'available' | 'occupied' | 'maintenance';
  currentForkliftId?: string;
  currentLockId?: string;
  power: number;
}

export interface ChargingPileCreateInput {
  code: string;
  name: string;
  power: number;
  operator: string;
  role: string;
}

export interface ChargingPileUpdateInput {
  id: string;
  status?: 'available' | 'occupied' | 'maintenance';
  currentForkliftId?: string;
  currentLockId?: string;
  operator: string;
  role: string;
}
