export type EquipmentType =
  | 'camera'
  | 'lens'
  | 'light_stand'
  | 'battery'
  | 'memory_card'
  | 'filter'
  | 'tripod'
  | 'reflector'

export type Severity = 'minor' | 'major' | 'fatal'

export type Difficulty = 'beginner' | 'intermediate' | 'expert'

export interface EquipmentItem {
  id: string
  name: string
  type: EquipmentType
  icon: string
  baseDeposit: number
  accessoryIds: string[]
  hasDamage: boolean
  batteryLevel?: number
  position: { x: number; y: number; z: number }
}

export interface Accessory {
  id: string
  name: string
  icon: string
  equipmentId: string
  isMissing: boolean
}

export interface Damage {
  id: string
  equipmentId: string
  description: string
  severity: Severity
  isNormalWear: boolean
}

export interface DepositRule {
  equipmentId: string
  baseAmount: number
  scratchMultiplier: number
  stainMultiplier: number
  missingPartPenalty: number
  lowBatteryPenalty: number
}

export interface RedHerring {
  id: string
  name: string
  icon: string
  reason: string
  position: { x: number; y: number; z: number }
}

export interface Level {
  id: string
  name: string
  difficulty: Difficulty
  icon: string
  timeLimit: number
  description: string
  equipment: EquipmentItem[]
  accessories: Accessory[]
  damages: Damage[]
  depositRules: DepositRule[]
  redHerrings: RedHerring[]
  correctDepositAmounts: Record<string, number>
}

export type ActionType =
  | 'match_accessory'
  | 'unmatch_accessory'
  | 'mark_damage'
  | 'unmark_damage'
  | 'calculate_deposit'
  | 'submit'
  | 'identify_red_herring'
  | 'mark_normal_wear'

export interface PlayerAction {
  timestamp: number
  actionType: ActionType
  targetId: string
  details?: string
  isCorrect?: boolean
}

export interface ScoreBreakdown {
  accessoryScore: number
  damageScore: number
  depositScore: number
  normalWearScore: number
  redHerringScore: number
  timeBonus: number
  speedBonus: number
  total: number
}

export interface ScoreResult {
  score: number
  breakdown: ScoreBreakdown
  failures: string[]
  passed: boolean
  needsTraining: boolean
  correctDepositAmounts: Record<string, number>
  playerDepositAmounts: Record<string, number>
  matchedAccessories: Record<string, string>
  correctAccessoryMatches: Record<string, string>
  markedDamages: Record<string, string>
  correctDamages: Record<string, string>
  markedNormalWears: string[]
  identifiedRedHerrings: string[]
}

export interface GameHistory {
  levelId: string
  levelName: string
  score: number
  passed: boolean
  failures: string[]
  timestamp: number
}
