export interface FurnitureItem {
  id: string;
  name: string;
  category: string;
  width: number;
  height: number;
  depth: number;
  weight: number;
  isNonDisassemblable: boolean;
  quantity: number;
}

export interface MovingOrder {
  orderId: string;
  customerName: string;
  sourceAddress: string;
  targetAddress: string;
  sourceFloor: number;
  targetFloor: number;
  hasElevator: boolean;
  movingDate: string;
  furnitureItems: FurnitureItem[];
  specialRequirements: string[];
}

export interface ParsedItem {
  raw: any;
  lineNumber: number;
  fileName: string;
  data: FurnitureItem | null;
}

export interface FileParseResult {
  fileName: string;
  success: boolean;
  items: ParsedItem[];
  errors: ParseError[];
}

export interface ParseError {
  lineNumber: number;
  fileName: string;
  errorType: string;
  message: string;
  rawContent: string;
}

export interface EstimationRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
}

export interface VolumeRule extends EstimationRule {
  paddingFactor: number;
  stackingAllowance: number;
}

export interface WeightRule extends EstimationRule {
  maxWeightPerTruck: number;
  weightDistributionFactor: number;
}

export interface SpecialCaseRule extends EstimationRule {
  nonDisassemblableMultiplier: number;
  noElevatorFloorPenalty: number;
  reRunableItemDiscount: number;
}

export interface EstimationConfig {
  volumeRules: VolumeRule;
  weightRules: WeightRule;
  specialCaseRules: SpecialCaseRule;
  truckTypes: TruckType[];
}

export interface TruckType {
  id: string;
  name: string;
  maxVolume: number;
  maxWeight: number;
  baseCost: number;
}

export interface EstimationResult {
  orderId: string;
  totalVolume: number;
  totalWeight: number;
  adjustedVolume: number;
  adjustedWeight: number;
  recommendedTrucks: TruckRecommendation[];
  specialCases: SpecialCase[];
  estimationDetails: EstimationDetail[];
}

export interface TruckRecommendation {
  truckType: TruckType;
  quantity: number;
  totalCost: number;
}

export interface SpecialCase {
  itemId: string;
  itemName: string;
  caseType: 'nonDisassemblable' | 'noElevator' | 'reRunable';
  description: string;
  impact: string;
}

export interface EstimationDetail {
  itemName: string;
  lineNumber: number;
  fileName: string;
  volume: number;
  weight: number;
  adjustedVolume: number;
  adjustedWeight: number;
  notes: string[];
}

export interface ExceptionReport {
  totalFiles: number;
  successfulFiles: number;
  failedFiles: number;
  fileReports: FileExceptionReport[];
  summary: ExceptionSummary;
}

export interface FileExceptionReport {
  fileName: string;
  status: 'success' | 'partial' | 'failed';
  totalItems: number;
  successfulItems: number;
  failedItems: number;
  errors: ParseError[];
  specialCases: SpecialCase[];
}

export interface ExceptionSummary {
  totalErrors: number;
  errorByType: Record<string, number>;
  totalSpecialCases: number;
  specialCasesByType: Record<string, number>;
}
