export type NoiseType = 'surface' | 'crackle' | 'pop' | 'warble' | 'distortion';
export type CleanerType = 'typeA' | 'typeB' | 'typeC';
export type StylusType = 'normal' | 'precision';
export type StepType = 'noise_analysis' | 'scratch_detection' | 'cleaning' | 'listening' | 'reporting';
export type ErrorType = 'scratch_misjudgment' | 'over_cleaning' | 'missing_listening_record';
export type DataSource = 'system' | 'manual';
export type RecordCondition = 'poor' | 'fair' | 'good' | 'excellent';
export type ScratchSeverity = 'light' | 'medium' | 'deep';
export type GameStatus = 'idle' | 'playing' | 'paused' | 'completed';

export interface Scratch {
  id: string;
  position: number;
  angle: number;
  severity: ScratchSeverity;
  isFalsePositive: boolean;
  length: number;
  detected: boolean;
  repaired: boolean;
}

export interface Noise {
  id: string;
  type: NoiseType;
  frequency: number;
  amplitude: number;
  dataSource: DataSource;
  note?: string;
  detectedAt: number;
  analyzed: boolean;
}

export interface VinylRecord {
  id: string;
  title: string;
  artist: string;
  condition: RecordCondition;
  difficulty: 1 | 2 | 3;
  scratches: Scratch[];
  noises: Noise[];
  coverImage: string;
}

export interface Inventory {
  cleanerA: number;
  cleanerB: number;
  cleanerC: number;
  stylusNormal: number;
  stylusPrecision: number;
}

export interface ErrorEntry {
  type: ErrorType;
  timestamp: number;
  stepId: string;
  description: string;
  params: Record<string, any>;
}

export interface ErrorTracking {
  scratchMisjudgment: number;
  overCleaning: number;
  missingListeningRecord: number;
  errors: ErrorEntry[];
}

export interface FilterOptions {
  timeRange: [number, number] | null;
  errorTypes: ErrorType[];
  dataSources: DataSource[];
  stepTypes: StepType[];
}

export interface GameState {
  sessionId: string;
  playerName: string;
  currentRecord: VinylRecord | null;
  currentStepIndex: number;
  qualityScore: number;
  customerPatience: number;
  inventory: Inventory;
  errorTracking: ErrorTracking;
  repairSteps: RepairStep[];
  status: GameStatus;
  playbackSpeed: number;
  playbackIndex: number;
  filterOptions: FilterOptions;
  selectedScratchId: string | null;
  selectedCleanerType: CleanerType | null;
  cleaningAmount: number;
  listeningRecorded: boolean;
  manualNotes: string;
}

export interface RepairStep {
  id: string;
  type: StepType;
  timestamp: number;
  isCorrect: boolean;
  params: Record<string, any>;
  snapshot: Partial<GameState>;
  dataSource: DataSource;
}

export interface RepairReport {
  sessionId: string;
  exportTime: number;
  filterOptions: FilterOptions;
  recordInfo: VinylRecord;
  qualityScore: number;
  errorSummary: ErrorTracking;
  steps: RepairStep[];
  dataSourceMarks: Array<{
    stepId: string;
    dataSource: DataSource;
    content: string;
  }>;
}

export interface CleanerInfo {
  type: CleanerType;
  name: string;
  description: string;
  color: string;
  suitableFor: ScratchSeverity[];
}

export interface NoiseTypeInfo {
  type: NoiseType;
  name: string;
  description: string;
  color: string;
}

export const STEPS: { type: StepType; name: string; description: string }[] = [
  { type: 'noise_analysis', name: '噪声分析', description: '分析噪声类型，标注人工备注' },
  { type: 'scratch_detection', name: '划痕检测', description: '检测并标记划痕位置' },
  { type: 'cleaning', name: '清洗操作', description: '选择清洗剂和剂量' },
  { type: 'listening', name: '唱针试听', description: '试听并记录结果' },
  { type: 'reporting', name: '报告生成', description: '生成修复报告' },
];

export const CLEANER_INFO: CleanerInfo[] = [
  { type: 'typeA', name: '温和清洗剂', description: '适用于轻微划痕', color: '#4CAF50', suitableFor: ['light'] },
  { type: 'typeB', name: '标准清洗剂', description: '适用于中等划痕', color: '#FF9800', suitableFor: ['light', 'medium'] },
  { type: 'typeC', name: '强力清洗剂', description: '适用于深度划痕', color: '#F44336', suitableFor: ['medium', 'deep'] },
];

export const NOISE_TYPE_INFO: NoiseTypeInfo[] = [
  { type: 'surface', name: '表面噪声', description: '唱片表面灰尘引起', color: '#2196F3' },
  { type: 'crackle', name: '爆裂声', description: '细小裂纹引起', color: '#9C27B0' },
  { type: 'pop', name: '噼啪声', description: '颗粒污染引起', color: '#E91E63' },
  { type: 'warble', name: '颤音', description: '唱片变形引起', color: '#FF5722' },
  { type: 'distortion', name: '失真', description: '严重损坏引起', color: '#795548' },
];

export const ERROR_TYPE_INFO: Record<ErrorType, { name: string; color: string; description: string }> = {
  scratch_misjudgment: { name: '划痕误判', color: '#C0392B', description: '错误判断划痕的存在或严重程度' },
  over_cleaning: { name: '清洗过度', color: '#E67E22', description: '使用过多清洗剂或不匹配的类型' },
  missing_listening_record: { name: '试听漏记录', color: '#8E44AD', description: '未记录试听结果' },
};
