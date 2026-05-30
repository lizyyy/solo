export type ErrorType = 'pitch_mapping' | 'unit_error' | 'tension_exceeded' | 'spec_mismatch';

export type LayerType = 'original' | 'corrected' | 'final';

export type DetailCategory = 'tension_calc' | 'spec_match' | 'risk_assess' | 'repair_history';

export type InstrumentType = 'guitar' | 'violin' | 'piano' | 'bass' | 'other';

export type RiskLevel = 1 | 2 | 3 | 4 | 5;

export interface Customer {
  id: string;
  name: string;
  phone: string;
  notes: string;
  createdAt: string;
}

export interface Instrument {
  id: string;
  customerId: string;
  type: InstrumentType;
  brand: string;
  model: string;
  serialNumber: string;
  stringCount: number;
}

export interface ErrorTag {
  id: string;
  type: ErrorType;
  description: string;
  resolved: boolean;
  createdAt: string;
}

export interface DataLayer {
  tension: number;
  riskLevel: RiskLevel;
  conclusion: string;
  updatedAt: string;
}

export interface JudgmentDetail {
  id: string;
  category: DetailCategory;
  reason: string;
  evidence: string;
  version: number;
  createdAt: string;
}

export interface TensionRecord {
  id: string;
  instrumentId: string;
  stringNumber: number;
  stringSpec: string;
  pitch: string;
  stringLength: number;
  lengthUnit: 'mm' | 'cm' | 'inch';
  original: DataLayer;
  corrected?: DataLayer;
  final: DataLayer;
  errorTags: ErrorTag[];
  details: JudgmentDetail[];
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface StringSpec {
  gauge: string;
  material: string;
  brand: string;
  linearDensity: number;
  maxTension: number;
}

export interface PitchInfo {
  note: string;
  octave: number;
  frequency: number;
}

export interface AppState {
  records: TensionRecord[];
  customers: Customer[];
  instruments: Instrument[];
  currentRecordId: string | null;
  filters: {
    showTagged: boolean;
    errorType?: ErrorType;
    dateRange?: [string, string];
  };
}

export interface AppActions {
  setCurrentRecord: (id: string | null) => void;
  addRecord: (record: Omit<TensionRecord, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateRecord: (id: string, updates: Partial<TensionRecord>) => void;
  deleteRecord: (id: string) => void;
  addCustomer: (customer: Omit<Customer, 'id' | 'createdAt'>) => void;
  updateCustomer: (id: string, updates: Partial<Customer>) => void;
  addInstrument: (instrument: Omit<Instrument, 'id'>) => void;
  updateInstrument: (id: string, updates: Partial<Instrument>) => void;
  addErrorTag: (recordId: string, tag: Omit<ErrorTag, 'id' | 'createdAt'>) => void;
  resolveErrorTag: (recordId: string, tagId: string) => void;
  addJudgmentDetail: (recordId: string, detail: Omit<JudgmentDetail, 'id' | 'createdAt'>) => void;
  setFilters: (filters: Partial<AppState['filters']>) => void;
  recalculateRecord: (id: string) => void;
}

export const ERROR_TYPE_LABELS: Record<ErrorType, string> = {
  pitch_mapping: '音高映射错误',
  unit_error: '弦长单位错误',
  tension_exceeded: '张力超限',
  spec_mismatch: '规格不匹配',
};

export const LAYER_TYPE_LABELS: Record<LayerType, string> = {
  original: '原始值',
  corrected: '修正值',
  final: '最终结论',
};

export const DETAIL_CATEGORY_LABELS: Record<DetailCategory, string> = {
  tension_calc: '张力计算',
  spec_match: '规格匹配',
  risk_assess: '风险分层',
  repair_history: '维修历史',
};

export const INSTRUMENT_TYPE_LABELS: Record<InstrumentType, string> = {
  guitar: '吉他',
  violin: '小提琴',
  piano: '钢琴',
  bass: '贝斯',
  other: '其他',
};

export const RISK_LEVEL_LABELS: Record<RiskLevel, string> = {
  1: '极低风险',
  2: '低风险',
  3: '中等风险',
  4: '高风险',
  5: '极高风险',
};

export const RISK_LEVEL_COLORS: Record<RiskLevel, string> = {
  1: 'success',
  2: 'success',
  3: 'warning',
  4: 'warning',
  5: 'danger',
};
