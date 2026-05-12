export interface Employee {
  id: string;
  employeeNo: string;
  name: string;
  department: string;
  currentLineId: string | null;
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
}

export interface Skill {
  id: string;
  name: string;
  code: string;
  description: string;
  createdAt: string;
}

export interface EmployeeSkill {
  id: string;
  employeeId: string;
  skillId: string;
  level: 1 | 2 | 3 | 4 | 5;
  createdAt: string;
}

export interface ProductionLine {
  id: string;
  lineNo: string;
  name: string;
  requiredSkillId: string;
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
}

export interface LineSwapRequest {
  id: string;
  requestNo: string;
  employeeId: string;
  fromLineId: string | null;
  toLineId: string;
  reason: string;
  requestedBy: string;
  requestedAt: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  approvedBy: string | null;
  approvedAt: string | null;
  startTime: string;
  endTime: string | null;
  skillMatch: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface WorkHour {
  id: string;
  employeeId: string;
  lineId: string;
  swapRequestId: string | null;
  date: string;
  hours: number;
  confirmedBy: string | null;
  confirmedAt: string | null;
  status: 'draft' | 'confirmed';
  createdAt: string;
}

export interface Absence {
  id: string;
  employeeId: string;
  date: string;
  type: 'sick' | 'personal' | 'annual' | 'other';
  reason: string;
  hours: number;
  approvedBy: string | null;
  approvedAt: string | null;
  createdAt: string;
}

export interface Performance {
  id: string;
  employeeId: string;
  lineId: string;
  month: string;
  totalHours: number;
  normalHours: number;
  overtimeHours: number;
  absenceHours: number;
  efficiency: number;
  qualityRate: number;
  calculatedAt: string;
}

export interface OperationHistory {
  id: string;
  operationType: string;
  entityType: string;
  entityId: string;
  operatorId: string;
  operatorName: string;
  beforeData: any;
  afterData: any;
  remark: string;
  createdAt: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}
