import { BaseEntity, ShiftType } from './types';

export interface Shift extends BaseEntity {
  date: string;
  shiftType: ShiftType;
  startTime: string;
  endTime: string;
  manager: string;
  status: 'scheduled' | 'ongoing' | 'completed';
}

export interface ShiftCreateInput {
  date: string;
  shiftType: ShiftType;
  startTime: string;
  endTime: string;
  manager: string;
  operator: string;
  role: string;
}

export interface ShiftUpdateInput {
  id: string;
  status?: 'scheduled' | 'ongoing' | 'completed';
  manager?: string;
  operator: string;
  role: string;
}
