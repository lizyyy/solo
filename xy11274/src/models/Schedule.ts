import { BaseEntity, ShiftType } from './types';

export interface Schedule extends BaseEntity {
  shiftId: string;
  date: string;
  shiftType: ShiftType;
  forkliftId: string;
  forkliftCode: string;
  operatorName: string;
  taskDescription: string;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  priority: number;
}

export interface ScheduleCreateInput {
  shiftId: string;
  date: string;
  shiftType: ShiftType;
  forkliftId: string;
  forkliftCode: string;
  operatorName: string;
  taskDescription: string;
  priority?: number;
  operator: string;
  role: string;
  idempotentKey?: string;
}

export interface ScheduleUpdateInput {
  id: string;
  status?: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  taskDescription?: string;
  operator: string;
  role: string;
}
