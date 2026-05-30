export interface Lane {
  id: string
  type: 'straight' | 'left' | 'right' | 'bus'
  direction: string
}

export interface Approach {
  id: string
  direction: 'north' | 'south' | 'east' | 'west'
  lanes: Lane[]
  vehicleFlow: number
  pedestrianFlow: number
}

export interface BusRoute {
  id: string
  name: string
  approachId: string
  headwayMinutes: number
  peakHeadwayMinutes: number
}

export interface PedestrianCrossing {
  id: string
  approachId: string
  side: 'near' | 'far'
  avgWaitSeconds: number
}

export interface Scenario {
  id: string
  name: string
  difficulty: 'easy' | 'medium' | 'hard'
  intersectionType: 'cross' | 'T' | 'Y'
  approaches: Approach[]
  busRoutes: BusRoute[]
  pedestrianCrossings: PedestrianCrossing[]
  passThreshold: number
}

export interface Movement {
  approachId: string
  laneType: 'straight' | 'left' | 'right' | 'bus'
  pedestrianCrossingId?: string
}

export interface PhaseConfig {
  id: string
  name: string
  greenSeconds: number
  yellowSeconds: number
  redClearanceSeconds: number
  movements: Movement[]
}

export interface RiskItem {
  category: 'phase_conflict' | 'pedestrian_wait' | 'bus_priority'
  level: 'high' | 'medium' | 'low'
  description: string
  businessExplanation: string
}

export interface EvaluationResult {
  vehicleScore: number
  pedestrianScore: number
  busScore: number
  totalScore: number
  passed: boolean
  risks: RiskItem[]
  winReasons: string[]
  loseReasons: string[]
}

export interface GameResult extends EvaluationResult {
  gameId: string
  scenarioId: string
  scenarioName: string
  playerName: string
  phaseConfig: PhaseConfig[]
  passThreshold: number
}

export interface Game {
  id: string
  scenarioId: string
  playerName: string
  phaseConfig: PhaseConfig[]
  vehicleScore: number
  pedestrianScore: number
  busScore: number
  totalScore: number
  passed: boolean
  risks: RiskItem[]
  winReasons: string[]
  loseReasons: string[]
  createdAt: string
}

export interface ScenarioSummary {
  id: string
  name: string
  difficulty: 'easy' | 'medium' | 'hard'
  intersectionType: 'cross' | 'T' | 'Y'
  totalVehicleFlow: number
  totalPedestrianFlow: number
  busRouteCount: number
}

export interface LeaderboardEntry {
  playerName: string
  scenarioId: string
  scenarioName: string
  totalScore: number
  vehicleScore: number
  pedestrianScore: number
  busScore: number
  passed: boolean
  createdAt: string
}
