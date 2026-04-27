export type PetType = 'dog' | 'cat';

export type BodyShape = 
  | 'toy'      
  | 'small'    
  | 'medium'   
  | 'large'    
  | 'giant';

export type CoatType = 
  | 'short'     
  | 'medium'    
  | 'long'      
  | 'double'    
  | 'hairless';

export type Season = 
  | 'spring'    
  | 'summer'    
  | 'autumn'    
  | 'winter';

export type Scenario = 
  | 'daily'       
  | 'outdoor'     
  | 'sports'      
  | 'party'       
  | 'sleep';

export type SizeCode = 'XXS' | 'XS' | 'S' | 'M' | 'L' | 'XL' | 'XXL' | '3XL';

export type MaterialType = 
  | 'cotton'      
  | 'linen'       
  | 'fleece'      
  | 'wool'        
  | 'down'        
  | 'nylon'       
  | 'waterproof'  
  | 'velvet';

export interface Breed {
  id: string;
  name: string;
  petType: PetType;
  bodyShape: BodyShape;
  defaultCoatType: CoatType;
  typicalWeightRange: { min: number; max: number };
  typicalChestRange: { min: number; max: number };
  typicalLengthRange: { min: number; max: number };
  description?: string;
}

export interface SizeChart {
  id: string;
  petType: PetType;
  bodyShape: BodyShape;
  sizeCode: SizeCode;
  label: string;
  chestMin: number;
  chestMax: number;
  lengthMin: number;
  lengthMax: number;
  neckMin: number;
  neckMax: number;
  weightMin?: number;
  weightMax?: number;
}

export interface MaterialRule {
  id: string;
  materialType: MaterialType;
  name: string;
  description: string;
  suitableSeasons: Season[];
  suitableCoatTypes: CoatType[];
  suitableScenarios: Scenario[];
  pros: string[];
  cons: string[];
  careTips: string[];
}

export interface Measurement {
  id: string;
  petType: PetType;
  breedId?: string;
  breedName?: string;
  bodyShape: BodyShape;
  coatType: CoatType;
  chest: number;
  length: number;
  neck?: number;
  weight?: number;
  season: Season;
  scenario: Scenario;
}

export interface RecommendationResult {
  id: string;
  measurementId: string;
  timestamp: number;
  recommendedSize: SizeCode;
  sizeConfidence: 'exact' | 'between' | 'borderline';
  alternativeSizes: SizeCode[];
  sizeReasoning: string;
  recommendedMaterials: MaterialRecommendation[];
  overallTips: string[];
}

export interface MaterialRecommendation {
  materialType: MaterialType;
  name: string;
  reason: string;
  priority: 'high' | 'medium' | 'low';
}

export interface HistoryRecord {
  id: string;
  petName: string;
  measurement: Measurement;
  recommendation: RecommendationResult;
  createdAt: number;
  updatedAt: number;
}

export interface BodyShapeRule {
  shape: BodyShape;
  name: string;
  description: string;
  weightRange: { min: number; max: number };
  petType: PetType;
  examples: string[];
}

export interface AppContextType {
  currentMeasurement: Measurement | null;
  setCurrentMeasurement: (m: Measurement | null) => void;
  currentRecommendation: RecommendationResult | null;
  setCurrentRecommendation: (r: RecommendationResult | null) => void;
  historyRecords: HistoryRecord[];
  addHistoryRecord: (record: Omit<HistoryRecord, 'id' | 'createdAt' | 'updatedAt'>) => string;
  updateHistoryRecord: (id: string, updates: Partial<HistoryRecord>) => void;
  deleteHistoryRecord: (id: string) => void;
}

export const PET_TYPE_LABELS: Record<PetType, string> = {
  dog: '狗狗',
  cat: '猫咪',
};

export const BODY_SHAPE_LABELS: Record<BodyShape, string> = {
  toy: '超小型',
  small: '小型',
  medium: '中型',
  large: '大型',
  giant: '超大型',
};

export const COAT_TYPE_LABELS: Record<CoatType, string> = {
  short: '短毛',
  medium: '中毛',
  long: '长毛',
  double: '双层毛',
  hairless: '无毛',
};

export const SEASON_LABELS: Record<Season, string> = {
  spring: '春季',
  summer: '夏季',
  autumn: '秋季',
  winter: '冬季',
};

export const SCENARIO_LABELS: Record<Scenario, string> = {
  daily: '日常居家',
  outdoor: '户外出行',
  sports: '运动健身',
  party: '派对节日',
  sleep: '睡眠保暖',
};

export const MATERIAL_LABELS: Record<MaterialType, string> = {
  cotton: '纯棉',
  linen: '亚麻',
  fleece: '摇粒绒',
  wool: '羊毛',
  down: '羽绒',
  nylon: '尼龙',
  waterproof: '防水面料',
  velvet: '丝绒',
};

export const SIZE_LABELS: Record<SizeCode, string> = {
  XXS: '加加小',
  XS: '加小',
  S: '小码',
  M: '中码',
  L: '大码',
  XL: '加大',
  XXL: '加加大',
  '3XL': '三加大',
};
