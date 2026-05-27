export type DataSourceType = 'alarm' | 'inspection' | 'maintenance';
export type RecordStatus = 'normal' | 'pending' | 'failed';
export type RuleType = 'same_pole_multi_lamp' | 'false_positive_filter' | 'repair_retest' | 'duplicate_check' | 'data_validation';

export interface LightAlarm {
  id?: string;
  alarmId: string;
  poleId: string;
  lampId: string;
  alarmTime: string;
  alarmType: string;
  alarmLevel: 'low' | 'medium' | 'high' | 'critical';
  location: string;
  description?: string;
  source?: string;
  [key: string]: any;
}

export interface InspectionRecord {
  id?: string;
  inspectionId: string;
  poleId: string;
  lampId?: string;
  inspector: string;
  inspectionTime: string;
  status: 'normal' | 'abnormal' | 'damaged';
  issues?: string[];
  photos?: string[];
  location: string;
  remarks?: string;
  [key: string]: any;
}

export interface MaintenanceOrder {
  id?: string;
  orderId: string;
  poleId: string;
  lampId?: string;
  repairType: string;
  reporter: string;
  reportTime: string;
  repairTime?: string;
  repairer?: string;
  status: 'pending' | 'processing' | 'completed' | 'cancelled';
  beforePhotos?: string[];
  afterPhotos?: string[];
  materials?: string[];
  cost?: number;
  remarks?: string;
  location: string;
  [key: string]: any;
}

export type UnifiedRecord = LightAlarm | InspectionRecord | MaintenanceOrder;

export interface RuleResult {
  ruleType: RuleType;
  ruleName: string;
  passed: boolean;
  message: string;
  suggestion?: string;
  details?: Record<string, any>;
}

export interface ProcessedRecord<T = UnifiedRecord> {
  originalId: string;
  sourceType: DataSourceType;
  status: RecordStatus;
  originalData: T;
  unifiedData: {
    poleId: string;
    lampId?: string;
    location: string;
    time: string;
    type: string;
  };
  ruleResults: RuleResult[];
  finalSuggestion: string;
  isDuplicate: boolean;
  duplicateOf?: string;
}

export interface BatchProcessRequest {
  batchId: string;
  source: DataSourceType;
  records: UnifiedRecord[];
}

export interface BatchProcessResult {
  batchId: string;
  processedAt: string;
  sourceType: DataSourceType;
  summary: {
    total: number;
    normal: number;
    pending: number;
    failed: number;
    duplicates: number;
  };
  categories: {
    normal: ProcessedRecord[];
    pending: ProcessedRecord[];
    failed: ProcessedRecord[];
  };
  ruleBreakdown: {
    [key in RuleType]?: {
      name: string;
      triggered: number;
      passed: number;
      failed: number;
    };
  };
  boundaryCases: {
    description: string;
    records: ProcessedRecord[];
  }[];
}

export interface FileUploadResult {
  batchId: string;
  filename: string;
  sourceType: DataSourceType;
  recordCount: number;
  uploadedAt: string;
}

export interface BatchInfo {
  batchId: string;
  sourceType: DataSourceType;
  recordCount: number;
  processedAt: string;
  fileHash: string;
}
