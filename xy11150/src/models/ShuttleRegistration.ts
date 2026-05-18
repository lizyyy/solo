export interface ShuttleRegistration {
  employeeId: string;
  employeeName: string;
  department: string;
  phone: string;
  routeName: string;
  boardingPoint: string;
  boardingTime: string;
  registrationDate: string;
  status: ShuttleStatus;
  rawData: Record<string, unknown>;
  sourceFile: string;
  rowNumber: number;
}

export type ShuttleStatus = '正常' | '调岗' | '待审核' | '已取消';

export interface DedupKey {
  type: 'employeeId' | 'phone' | 'nameAndPhone';
  value: string;
}

export interface DuplicateRecord {
  original: ShuttleRegistration;
  duplicates: ShuttleRegistration[];
  reason: string;
  key: DedupKey;
}

export interface TransferRecord {
  employeeId: string;
  employeeName: string;
  oldRoute: string;
  newRoute: string;
  oldBoardingPoint: string;
  newBoardingPoint: string;
  transferDate: string;
}

export interface SharedPhoneRecord {
  phone: string;
  employees: Array<{
    employeeId: string;
    employeeName: string;
    department: string;
    routeName: string;
  }>;
}

export interface ProcessResult {
  totalRecords: number;
  validRecords: number;
  duplicateRecords: DuplicateRecord[];
  transferRecords: TransferRecord[];
  sharedPhoneRecords: SharedPhoneRecord[];
  invalidRecords: InvalidRecord[];
  outputPath: string;
  reportPath: string;
  runId: string;
  processedAt: Date;
}

export interface InvalidRecord {
  sourceFile: string;
  rowNumber: number;
  rawData: Record<string, unknown>;
  errors: string[];
}

export type EncodingType = 'UTF-8' | 'GBK' | 'GB2312' | 'Auto';

export interface ImportOptions {
  encoding?: EncodingType;
  delimiter?: string;
  hasHeader?: boolean;
}

export interface ColumnMapping {
  employeeId: string[];
  employeeName: string[];
  department: string[];
  phone: string[];
  routeName: string[];
  boardingPoint: string[];
  boardingTime: string[];
  registrationDate: string[];
  status: string[];
}

export const DEFAULT_COLUMN_MAPPING: ColumnMapping = {
  employeeId: ['员工编号', '工号', 'employeeId', 'empId', '编号'],
  employeeName: ['姓名', '员工姓名', 'employeeName', 'name'],
  department: ['部门', '所属部门', 'department', 'dept'],
  phone: ['手机号', '手机号码', '电话', 'phone', 'mobile', 'telephone'],
  routeName: ['线路', '班车线路', '线路名称', 'routeName', 'route'],
  boardingPoint: ['上车点', '乘车点', ' boardingPoint', 'point'],
  boardingTime: ['发车时间', '乘车时间', 'boardingTime', 'time'],
  registrationDate: ['报名日期', '报名时间', 'registrationDate', 'date'],
  status: ['状态', '报名状态', 'status', 'state']
};
