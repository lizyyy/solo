export type MaterialType = 'absorption_board' | 'absorption_cotton' | 'diffuser' | 'membrane' | 'perforated_panel'

export type FrequencyBand = '125Hz' | '250Hz' | '500Hz' | '1kHz' | '2kHz' | '4kHz'

export const FREQUENCY_BANDS: FrequencyBand[] = ['125Hz', '250Hz', '500Hz', '1kHz', '2kHz', '4kHz']

export const LOW_FREQ_BANDS: FrequencyBand[] = ['125Hz', '250Hz']
export const MID_FREQ_BANDS: FrequencyBand[] = ['500Hz', '1kHz']
export const HIGH_FREQ_BANDS: FrequencyBand[] = ['2kHz', '4kHz']

export const MATERIAL_TYPE_LABELS: Record<MaterialType, string> = {
  absorption_board: '吸声板',
  absorption_cotton: '吸声棉',
  diffuser: '扩散体',
  membrane: '薄膜共振器',
  perforated_panel: '穿孔板',
}

export const MATERIAL_TYPE_COLORS: Record<MaterialType, string> = {
  absorption_board: '#4ade80',
  absorption_cotton: '#60a5fa',
  diffuser: '#fb923c',
  membrane: '#c084fc',
  perforated_panel: '#f472b6',
}

export const FREQ_BAND_LABELS: Record<FrequencyBand, string> = {
  '125Hz': '125Hz',
  '250Hz': '250Hz',
  '500Hz': '500Hz',
  '1kHz': '1kHz',
  '2kHz': '2kHz',
  '4kHz': '4kHz',
}

export interface Material {
  id: string
  name: string
  type: MaterialType
  unitPrice: number
  coefficients: Record<FrequencyBand, number | null>
  thickness: number
  notes: string
}

export interface ValidationIssue {
  materialId: string
  materialName: string
  type: 'coefficient_out_of_range' | 'frequency_missing' | 'field_empty' | 'budget_overrun'
  frequency?: FrequencyBand
  detail: string
  severity: 'error' | 'warning'
}

export interface WeightConfig {
  lowWeight: number
  midWeight: number
  highWeight: number
}

export interface RoomConfig {
  length: number
  width: number
  height: number
  budget: number
}

export interface CombinationItem {
  materialId: string
  areaRatio: number
}

export interface MaterialCombination {
  id: string
  name: string
  items: CombinationItem[]
  totalCost: number
  combinedCoefficients: Record<FrequencyBand, number>
  weightedScore: number
}

export interface ScoreBreakdown {
  materialId: string
  materialName: string
  rawCoefficients: Record<FrequencyBand, number | null>
  weightApplied: Record<FrequencyBand, number>
  weightedValues: Record<FrequencyBand, number>
  totalScore: number
  issues: ValidationIssue[]
}

export interface ComparisonSelection {
  materialIds: string[]
  combinationIds: string[]
}
