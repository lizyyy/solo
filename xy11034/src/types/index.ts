export enum BatchStatus {
  DRAFT = 'draft',
  PENDING = 'pending',
  APPROVED = 'approved',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  NEEDS_ATTENTION = 'needs_attention',
  REJECTED = 'rejected'
}

export enum CoffeeOrigin {
  ETHIOPIA_YIRGACHEFFE = 'ethiopia_yirgacheffe',
  COLOMBIA_SUPREMO = 'colombia_supremo',
  BRAZIL_CERRADO = 'brazil_cerrado',
  GUATEMALA_ANTIGUA = 'guatemala_antigua',
  KENYA_AA = 'kenya_aa',
  SUMATRA_MANDHELING = 'sumatra_mandheling',
  COSTA_RICA_TARRABU = 'costa_rica_tarrabu',
  PANAMA_GEISHA = 'panama_geisha'
}

export enum RoastLevel {
  LIGHT = 'light',
  MEDIUM_LIGHT = 'medium_light',
  MEDIUM = 'medium',
  MEDIUM_DARK = 'medium_dark',
  DARK = 'dark',
  FRENCH = 'french'
}

export enum ProcessingMethod {
  WASHED = 'washed',
  NATURAL = 'natural',
  HONEY = 'honey',
  ANAEROBIC = 'anaerobic'
}

export interface RoastingCurve {
  id: string;
  name: string;
  description: string;
  targetFirstCrackTime: number;
  targetSecondCrackTime: number;
  targetDropTemperature: number;
  temperaturePoints: TemperaturePoint[];
  createdAt: Date;
}

export interface TemperaturePoint {
  time: number;
  temperature: number;
  airflow: number;
}

export interface GreenCoffee {
  id: string;
  batchNumber: string;
  origin: CoffeeOrigin;
  farm: string;
  altitude: number;
  variety: string;
  processingMethod: ProcessingMethod;
  harvestYear: number;
  moistureContent: number;
  screenSize: string;
  cuppingScore: number;
  quantityKg: number;
  receivedDate: Date;
  supplier: string;
  notes: string;
}

export interface RoastingBatch {
  id: string;
  batchNumber: string;
  greenCoffeeId: string;
  greenCoffee: GreenCoffee;
  roastingCurveId: string;
  roastingCurve: RoastingCurve;
  roastMaster: string;
  machineId: string;
  machineName: string;
  plannedWeightKg: number;
  actualWeightKg: number;
  roastLevel: RoastLevel;
  status: BatchStatus;
  startTime: Date | null;
  endTime: Date | null;
  firstCrackTime: number | null;
  secondCrackTime: number | null;
  dropTemperature: number | null;
  weightLossPercentage: number | null;
  actualTemperaturePoints: TemperaturePoint[];
  cuppingResult: CuppingResult | null;
  qualityAssessor: string | null;
  rejectionReason: string | null;
  attentionReasons: string[];
  traceabilityNotes: string;
  parentBatchId: string | null;
  childBatchIds: string[];
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CuppingResult {
  aroma: number;
  flavor: number;
  acidity: number;
  body: number;
  balance: number;
  aftertaste: number;
  uniformity: number;
  cleanCup: number;
  sweetness: number;
  overall: number;
  notes: string;
  cuppedBy: string;
  cuppedAt: Date;
}

export interface BatchHistory {
  id: string;
  batchId: string;
  action: string;
  previousStatus: BatchStatus | null;
  newStatus: BatchStatus;
  changedBy: string;
  changedAt: Date;
  comment: string;
  metadata: Record<string, any>;
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
  suggestedAction?: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: ValidationError[];
  timestamp: Date;
}

export interface BatchReport {
  batchId: string;
  batchNumber: string;
  origin: string;
  roastLevel: string;
  status: BatchStatus;
  plannedWeightKg: number;
  actualWeightKg: number;
  weightLossPercentage: number | null;
  roastDuration: number | null;
  cuppingScore: number | null;
  issues: string[];
  roastedAt: Date | null;
}
