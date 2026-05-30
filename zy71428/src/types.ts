export interface Suspect {
  id: string
  name: string
  avatar: string
  description: string
  priorProbability: number
  currentProbability: number
  isGuilty: boolean
}

export type ClueType = 'incriminating' | 'exonerating' | 'neutral'

export interface Clue {
  id: string
  title: string
  description: string
  type: ClueType
  likelihoods: Record<string, number>
  relatedClueIds: string[]
  consistencyNote?: string
}

export interface BayesCalculation {
  suspectId: string
  suspectName: string
  prior: number
  likelihood: number
  numerator: number
  denominator: number
  posterior: number
  formula: string
  isPriorSupplement: boolean
  priorSupplementNote?: string
}

export interface InferenceStep {
  stepNumber: number
  clue: Clue
  timestamp: number
  priorProbabilities: Record<string, number>
  posteriorProbabilities: Record<string, number>
  calculationDetails: BayesCalculation[]
  explanation: string
  isDuplicateEvidence: boolean
  duplicateNote?: string
  arrivalOrder: number
  isReversedConditional: boolean
  reversedConditionalNote?: string
}

export type GameStatus = 'idle' | 'playing' | 'paused' | 'ended'

export interface GameState {
  status: GameStatus
  suspects: Suspect[]
  clueDeck: Clue[]
  drawnClues: Clue[]
  inferenceHistory: InferenceStep[]
  currentStep: number
  isReplayMode: boolean
  revealGuilty: boolean
}
