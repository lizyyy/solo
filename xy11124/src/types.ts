export interface SourceInfo {
  file: string;
  line: number;
  column?: number;
}

export interface Contraindication {
  id: string;
  patientId: string;
  patientName: string;
  type: string;
  description: string;
  level: 'high' | 'medium' | 'low';
  effectiveDate: string;
  expiryDate: string;
  status: 'active' | 'expired' | 'revoked';
  source?: SourceInfo;
}

export interface TreatmentPackage {
  id: string;
  name: string;
  category: string;
  treatments: string[];
  contraindications: string[];
  price: number;
  duration: number;
  source?: SourceInfo;
}

export interface ScreeningRecord {
  id: string;
  batchId: string;
  patientId: string;
  patientName: string;
  treatmentPackageId: string;
  treatmentPackageName: string;
  screeningDate: string;
  result: 'pass' | 'fail' | 'warning';
  issues: ScreeningIssue[];
  sourceFile: string;
  sourceLine: number;
  processedAt: string;
}

export interface ScreeningIssue {
  type: 'expired_contraindication' | 'package_mismatch' | 'missing_info' | 'other';
  severity: 'critical' | 'warning' | 'info';
  message: string;
  details: {
    contraindicationId?: string;
    contraindicationType?: string;
    expiryDate?: string;
    packageId?: string;
    expectedCategory?: string;
    actualCategory?: string;
  };
  source: SourceInfo;
}

export interface ParseError {
  file: string;
  line?: number;
  message: string;
  error: string;
}

export interface ScreeningResult {
  batchId: string;
  processedAt: string;
  totalRecords: number;
  passed: number;
  failed: number;
  warnings: number;
  records: ScreeningRecord[];
  parseErrors: ParseError[];
  inputFiles: string[];
}

export const CONTRAINDICATION_TYPES = [
  '高血压',
  '心脏病',
  '糖尿病',
  '剖腹产伤口未愈合',
  '急性感染',
  '发热',
  '严重贫血',
  '精神疾病',
  '血栓性疾病',
  '肝肾功能异常',
  '恶性肿瘤',
  '活动性出血',
  '产后抑郁',
  '盆底肌肉严重损伤',
  '子宫复旧不良'
] as const;

export const PACKAGE_CATEGORIES = [
  '盆底康复',
  '子宫复旧',
  '形体恢复',
  '乳腺护理',
  '产后心理',
  '综合调理'
] as const;
