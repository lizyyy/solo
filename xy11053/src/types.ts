export enum CourtType {
  FULL = '整场',
  HALF = '半场',
  QUARTER = '四分之一场'
}

export enum CourtArea {
  NORTH = '北区',
  SOUTH = '南区',
  EAST = '东区',
  WEST = '西区'
}

export enum BookingStatus {
  NORMAL = '正常',
  RAIN_POSTPONED = '雨天顺延',
  COMPLETED = '已完成',
  CANCELLED = '已取消',
  HALF_PLAYED_FULL_POSTPONED = '半场打完整场顺延',
  EXCEPTION = '异常'
}

export enum RecordType {
  NORMAL = '正常记录',
  EXCEPTION = '异常记录'
}

export enum MaterialType {
  RAIN_REPORT = '雨情报告',
  ON_SITE_PHOTO = '现场照片',
  CUSTOMER_SIGNATURE = '客户签字确认',
  STAFF_RECORD = '工作人员记录',
  WEATHER_FORECAST = '天气预报截图',
  HALF_COURT_CONFIRM = '半场使用确认书'
}

export interface BookingRecord {
  id: string;
  bookingNo: string;
  bookingDate: string;
  bookingTimeStart: string;
  bookingTimeEnd: string;
  courtNo: string;
  courtArea: CourtArea;
  courtType: CourtType;
  customerName: string;
  customerPhone: string;
  customerId: string;
  bookerName: string;
  bookerDept: string;
  bookingAmount: number;
  paymentMethod: string;
  paymentTime: string;
  status: BookingStatus;
  isRainPostponed: boolean;
  postponeTimes: number;
  lastPostponeDate?: string;
  originalBookingDate?: string;
  rainStartTime?: string;
  rainEndTime?: string;
  rainLevel: '小雨' | '中雨' | '大雨' | '暴雨';
  materials: MaterialType[];
  materialUrls: string[];
  handlerName: string;
  handleTime: string;
  remarks: string;
  recordType: RecordType;
  exceptionReason?: string;
  isHalfPlayed: boolean;
  halfPlayedDuration?: number;
  createTime: string;
  updateTime: string;
}

export interface PostponeRequest {
  bookingNo: string;
  rainStartTime: string;
  rainEndTime: string;
  rainLevel: '小雨' | '中雨' | '大雨' | '暴雨';
  materials: MaterialType[];
  materialUrls: string[];
  handlerName: string;
  isHalfPlayed?: boolean;
  halfPlayedDuration?: number;
  remarks?: string;
}

export interface BatchPostponeRequest {
  records: PostponeRequest[];
  batchNo: string;
  handlerName: string;
  handleTime: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  requiredMaterials: MaterialType[];
  nextStep: string;
}

export interface PostponeResponse {
  success: boolean;
  bookingNo: string;
  status: BookingStatus;
  validation: ValidationResult;
  recordType: RecordType;
  message: string;
}

export interface BatchPostponeResponse {
  batchNo: string;
  totalCount: number;
  successCount: number;
  failedCount: number;
  exceptionCount: number;
  normalRecords: BookingRecord[];
  exceptionRecords: BookingRecord[];
  results: PostponeResponse[];
}

export interface ConsistencyCheckResult {
  isConsistent: boolean;
  inconsistencies: {
    bookingNo: string;
    issue: string;
    suggestion: string;
  }[];
  totalRecords: number;
  normalCount: number;
  exceptionCount: number;
  postponedCount: number;
  halfPlayedFullPostponedCount: number;
}

export interface ExportOptions {
  includeNormalRecords: boolean;
  includeExceptionRecords: boolean;
  startDate?: string;
  endDate?: string;
  statuses?: BookingStatus[];
}
