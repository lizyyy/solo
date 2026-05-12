export interface Employee {
  id: string;
  employeeNo: string;
  name: string;
  department: string;
  city: string;
  isProbation: boolean;
  probationSalary: number;
  regularSalary: number;
  createdAt: string;
  updatedAt: string;
}

export interface SalaryDetail {
  id: string;
  employeeId: string;
  year: number;
  month: number;
  baseSalary: number;
  bonus: number;
  allowance: number;
  totalSalary: number;
  createdAt: string;
}

export interface EmploymentRecord {
  id: string;
  employeeId: string;
  type: 'hire' | 'transfer' | 'resign';
  date: string;
  fromCity?: string;
  toCity?: string;
  reason?: string;
  operator: string;
  createdAt: string;
}

export interface CityRule {
  city: string;
  year: number;
  minBase: number;
  maxBase: number;
  effectiveDate: string;
  note?: string;
}

export interface HistoricalDeclaration {
  id: string;
  employeeId: string;
  year: number;
  declarationMonth: number;
  baseAmount: number;
  startMonth: number;
  endMonth: number;
  operator: string;
  status: 'draft' | 'submitted' | 'approved' | 'rejected';
  createdAt: string;
  updatedAt: string;
}

export interface ManualCorrection {
  id: string;
  employeeId: string;
  field: string;
  beforeValue: string | number;
  afterValue: string | number;
  reason: string;
  operator: string;
  createdAt: string;
}

export interface CalculationResult {
  employeeId: string;
  employeeName: string;
  employeeNo: string;
  department: string;
  city: string;
  currentCity: string;
  suggestedBase: number;
  originalBase: number;
  adjustmentReason: string;
  needSupplementary: boolean;
  supplementaryMonths: string[];
  supplementaryAmount: number;
  warnings: string[];
  status: 'ok' | 'warning' | 'error';
}

export interface CheckResultItem {
  type: 'info' | 'warning' | 'error';
  employeeId?: string;
  employeeName?: string;
  message: string;
}

export interface OperationLog {
  id: string;
  command: string;
  timestamp: string;
  operator: string;
  parameters: Record<string, any>;
  status: 'success' | 'failed';
  message?: string;
}

export interface ProjectConfig {
  name: string;
  declarationYear: number;
  declarationMonth: number;
  currentCity: string;
  dataDir: string;
  createdAt: string;
  updatedAt: string;
}
