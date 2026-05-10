export type SlopeDifficulty = 'EASY' | 'MEDIUM' | 'HARD' | 'EXPERT';
export type SlopeStatus = 'OPEN' | 'CLOSED' | 'MAINTENANCE';
export type VehicleStatus = 'AVAILABLE' | 'MAINTENANCE' | 'WORKING' | 'BROKEN';
export type TaskStatus = 'PENDING_ASSIGNMENT' | 'PENDING_EXECUTION' | 'IN_PROGRESS' | 'COMPLETED' | 'REJECTED' | 'CANCELLED';

export interface Slope {
  id: string;
  name: string;
  difficulty: SlopeDifficulty;
  length: number;
  area: number;
  openWindowStart: string;
  openWindowEnd: string;
  minSnowThickness: number;
  targetSnowThickness: number;
  currentSnowThickness: number;
  status: SlopeStatus;
  priority: number;
  createdAt: string;
  updatedAt: string;
}

export interface Vehicle {
  id: string;
  name: string;
  model: string;
  status: VehicleStatus;
  capacityPerHour: number;
  currentLocation: string;
  lastMaintenance?: string;
  assignedTaskId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Task {
  id: string;
  slopeId: string;
  vehicleId?: string;
  scheduledStartTime: string;
  scheduledEndTime: string;
  actualStartTime?: string;
  actualEndTime?: string;
  status: TaskStatus;
  reason?: string;
  snowThicknessBefore?: number;
  snowThicknessAfter?: number;
  qualityScore?: number;
  notes?: string;
  isReassigned: boolean;
  originalVehicleId?: string;
  createdAt: string;
  updatedAt: string;
  slope?: Slope;
  vehicle?: Vehicle;
}

export interface Report {
  id: string;
  taskId: string;
  reporter: string;
  reportTime: string;
  snowThicknessBefore: number;
  snowThicknessAfter: number;
  qualityScore: number;
  issues: string;
  remarks?: string;
  isApproved: boolean;
  approver?: string;
  approveTime?: string;
  createdAt: string;
  updatedAt: string;
  task?: Task;
}

export const difficultyLabels: Record<SlopeDifficulty, string> = {
  EASY: '初级',
  MEDIUM: '中级',
  HARD: '高级',
  EXPERT: '专业'
};

export const slopeStatusLabels: Record<SlopeStatus, string> = {
  OPEN: '开放',
  CLOSED: '关闭',
  MAINTENANCE: '维护中'
};

export const vehicleStatusLabels: Record<VehicleStatus, string> = {
  AVAILABLE: '可用',
  MAINTENANCE: '维修中',
  WORKING: '作业中',
  BROKEN: '故障'
};

export const taskStatusLabels: Record<TaskStatus, string> = {
  PENDING_ASSIGNMENT: '待分配',
  PENDING_EXECUTION: '待执行',
  IN_PROGRESS: '执行中',
  COMPLETED: '已完成',
  REJECTED: '已拒绝',
  CANCELLED: '已取消'
};

export const taskStatusColors: Record<TaskStatus, string> = {
  PENDING_ASSIGNMENT: '#f59e0b',
  PENDING_EXECUTION: '#3b82f6',
  IN_PROGRESS: '#10b981',
  COMPLETED: '#8b5cf6',
  REJECTED: '#ef4444',
  CANCELLED: '#6b7280'
};

export const vehicleStatusColors: Record<VehicleStatus, string> = {
  AVAILABLE: '#10b981',
  MAINTENANCE: '#f59e0b',
  WORKING: '#3b82f6',
  BROKEN: '#ef4444'
};
