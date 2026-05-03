export interface House {
  id: string;
  name: string;
  address: string;
  monthlyRent: number;
  deposit: number;
  depositType: '押一付一' | '押二付一' | '押三付一' | '其他';
  area: number;
  floor: string;
  orientation: string;
  commuteTime: number;
  commuteType: '地铁' | '公交' | '步行' | '驾车';
  contractTerm: number;
  agencyFee: number;
  additionalFees: AdditionalFee[];
  landlordPromises: string[];
  photos: string[];
  visitDate: string;
  contactPerson: string;
  contactPhone: string;
  notes: string;
}

export interface AdditionalFee {
  name: string;
  amount: number;
  period: '月付' | '季付' | '年付' | '一次性';
}

export interface VisitNote {
  id: string;
  houseId: string;
  visitDate: string;
  lighting: LightingScore;
  noise: NoiseScore;
  waterLeak: boolean;
  waterLeakDescription: string;
  odor: boolean;
  odorDescription: string;
  repairItems: RepairItem[];
  applianceStatus: ApplianceStatus[];
  surroundingSafety: SafetyScore;
  generalNotes: string;
  pendingQuestions: PendingQuestion[];
  photos: string[];
}

export type LightingScore = 1 | 2 | 3 | 4 | 5;
export type NoiseScore = 1 | 2 | 3 | 4 | 5;
export type SafetyScore = 1 | 2 | 3 | 4 | 5;

export interface RepairItem {
  item: string;
  severity: '轻微' | '中等' | '严重';
  needsLandlordRepair: boolean;
}

export interface ApplianceStatus {
  name: string;
  status: '正常' | '故障' | '缺失';
  notes: string;
}

export interface PendingQuestion {
  question: string;
  status: '待确认' | '已确认' | '放弃';
  answer: string;
}

export interface RatingConfig {
  weights: WeightConfig;
  scoreRanges: ScoreRangeConfig;
}

export interface WeightConfig {
  monthlyRent: number;
  depositRisk: number;
  commuteTime: number;
  lighting: number;
  noise: number;
  waterLeak: number;
  odor: number;
  repairCost: number;
  surroundingSafety: number;
  agencyFee: number;
  additionalFees: number;
}

export interface ScoreRangeConfig {
  excellent: { min: number; max: number };
  good: { min: number; max: number };
  fair: { min: number; max: number };
  poor: { min: number; max: number };
}

export interface ScoredHouse extends House {
  visitNote?: VisitNote;
  scores: HouseScores;
  riskFactors: RiskFactor[];
  overallScore: number;
  overallGrade: 'excellent' | 'good' | 'fair' | 'poor';
}

export interface HouseScores {
  monthlyRentScore: number;
  depositRiskScore: number;
  commuteTimeScore: number;
  lightingScore: number;
  noiseScore: number;
  waterLeakScore: number;
  odorScore: number;
  repairCostScore: number;
  surroundingSafetyScore: number;
  agencyFeeScore: number;
  additionalFeesScore: number;
}

export interface RiskFactor {
  category: string;
  level: '低' | '中' | '高';
  description: string;
  suggestion: string;
}

export interface FollowUpItem {
  id: string;
  houseId: string;
  question: string;
  status: '待确认' | '已确认' | '放弃';
  answer: string;
  updatedAt: string;
}

export interface ShortlistItem {
  houseId: string;
  addedAt: string;
  priority: '高' | '中' | '低';
  notes: string;
  followUps: FollowUpItem[];
}

export interface ProjectData {
  houses: House[];
  visitNotes: VisitNote[];
  shortlist: ShortlistItem[];
  ratingConfig: RatingConfig;
  lastUpdated: string;
}

export interface ValidationError {
  row: number;
  column: string;
  field: string;
  message: string;
  value: string;
}

export interface ImportResult<T> {
  success: boolean;
  data?: T[];
  errors: ValidationError[];
  warnings: ValidationError[];
}

export interface HouseJson {
  id: string;
  name: string;
  address: string;
  monthlyRent: number;
  deposit: number;
  depositType: string;
  area: number;
  floor: string;
  orientation: string;
  commuteTime: number;
  commuteType: string;
  contractTerm: number;
  agencyFee: number;
  additionalFees: {
    name: string;
    amount: number;
    period: string;
  }[];
  landlordPromises: string[];
  photos: string[];
  visitDate: string;
  contactPerson: string;
  contactPhone: string;
  notes: string;
}

export interface VisitNoteCsvRow {
  id: string;
  houseId: string;
  visitDate: string;
  lighting: string;
  noise: string;
  waterLeak: string;
  waterLeakDescription: string;
  odor: string;
  odorDescription: string;
  repairItems: string;
  applianceStatus: string;
  surroundingSafety: string;
  generalNotes: string;
  pendingQuestions: string;
  photos: string;
}
