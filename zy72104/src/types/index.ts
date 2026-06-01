export type AlertLevel = 'info' | 'notice' | 'warning' | 'danger'

export type UnitCategory = 'length' | 'pressure' | 'flow' | 'temperature' | 'velocity' | 'diameter' | 'roughness' | 'dimensionless'

export interface UnitDef {
  name: string
  symbol: string
  category: UnitCategory
  toSI: (v: number) => number
  fromSI: (v: number) => number
}

export interface SensorRecord {
  id: string
  parameterName: string
  rawValue: number
  rawUnit: string
  standardValue: number
  standardUnit: string
  timestamp: string
  direction: string
  source: string
  validated: boolean
  validationMessage: string
}

export interface EquipmentParams {
  pumpModel: string
  ratedHead: number
  ratedHeadUnit: string
  ratedFlow: number
  ratedFlowUnit: string
  pipeDiameter: number
  pipeDiameterUnit: string
  pipeLength: number
  pipeLengthUnit: string
  roughness: number
  efficiency: number
  suctionPressure: number
  suctionPressureUnit: string
  dischargePressure: number
  dischargePressureUnit: string
  fluidDensity: number
  fluidDensityUnit: string
  elevationDiff: number
  elevationDiffUnit: string
  localLossCoeff: number
}

export interface FieldNote {
  id: string
  content: string
  noteTime: string
  author: string
}

export interface ManualCorrection {
  id: string
  fieldName: string
  originalValue: number
  originalUnit: string
  correctedValue: number
  correctedUnit: string
  reason: string
  correctionTime: string
}

export interface CalcResult {
  staticHead: number
  dynamicHead: number
  frictionLoss: number
  localLoss: number
  totalHead: number
  totalLoss: number
  pumpEfficiency: number
  headDeviation: number
  lossRatio: number
  calcTime: string
  formulaUsed: string
  reynoldsNumber: number
  frictionFactor: number
}

export interface ThresholdAlert {
  id: string
  alertType: string
  level: AlertLevel
  value: number
  threshold: number
  unit: string
  message: string
  suggestion: string
}

export interface Suggestion {
  id: string
  category: string
  action: string
  explanation: string
  priority: AlertLevel
}

export interface ConflictRecord {
  id: string
  fieldName: string
  inspectionValue: string
  importedValue: string
  inspectionUnit: string
  importedUnit: string
  evidence: string
  suggestedAction: string
  resolved: boolean
  chosenSide: 'inspection' | 'imported' | null
}

export interface CalcBatch {
  id: string
  createTime: string
  processTime: string
  operatorName: string
  source: string
  sensorRecords: SensorRecord[]
  equipmentParams: EquipmentParams
  fieldNotes: FieldNote[]
  corrections: ManualCorrection[]
  result: CalcResult | null
  alerts: ThresholdAlert[]
  suggestions: Suggestion[]
  conflicts: ConflictRecord[]
}

export interface UnitValidation {
  valid: boolean
  message: string
  convertedValue: number | null
  fromUnit: string
  toUnit: string
  factor: number | null
}
