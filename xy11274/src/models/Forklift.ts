import { BaseEntity } from './types';

export interface Forklift extends BaseEntity {
  code: string;
  name: string;
  batteryLevel: number;
  status: 'available' | 'in_use' | 'charging' | 'maintenance';
  currentShift?: string;
  currentOperator?: string;
  lastChargingTime?: string;
}

export interface ForkliftCreateInput {
  code: string;
  name: string;
  batteryLevel: number;
  operator: string;
  role: string;
}

export interface ForkliftUpdateInput {
  id: string;
  batteryLevel?: number;
  status?: 'available' | 'in_use' | 'charging' | 'maintenance';
  currentShift?: string;
  currentOperator?: string;
  operator: string;
  role: string;
}
