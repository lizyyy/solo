export type Direction = 'north' | 'south' | 'east' | 'west'
export type LightState = 'red' | 'yellow' | 'green'
export type VehicleType = 'car' | 'truck' | 'motorcycle'
export type ConflictType = 'phase_offset' | 'pedestrian_conflict' | 'trajectory_async'
export type Severity = 'low' | 'medium' | 'high'
export type ViewMode = '2d' | '3d'

export interface Lane {
  id: string
  direction: Direction
  turnType: 'straight' | 'left' | 'right'
  position: { x: number; y: number }[]
}

export interface Crosswalk {
  id: string
  position: { x: number; y: number }[]
  width: number
}

export interface TrafficLight {
  id: string
  direction: Direction
  position: { x: number; y: number; z: number }
}

export interface IntersectionGeometry {
  id: string
  name: string
  lanes: Lane[]
  crosswalks: Crosswalk[]
  trafficLights: TrafficLight[]
  center: { x: number; y: number }
}

export interface PhaseTiming {
  startTime: number
  endTime: number
  state: LightState
}

export interface SignalPhase {
  id: string
  direction: Direction
  name: string
  timing: PhaseTiming[]
}

export interface TrajectoryPoint {
  time: number
  x: number
  y: number
  angle?: number
}

export interface VehicleTrajectory {
  id: string
  type: VehicleType
  color: string
  plateNumber?: string
  points: TrajectoryPoint[]
}

export interface PedestrianTrajectory {
  id: string
  name?: string
  points: TrajectoryPoint[]
}

export interface AccidentPoint {
  id: string
  time: number
  x: number
  y: number
  type: string
  description: string
}

export interface Conflict {
  id: string
  time: number
  type: ConflictType
  description: string
  severity: Severity
  x: number
  y: number
  involvedElements?: string[]
}

export interface SceneFilters {
  showVehicles: boolean
  showPedestrians: boolean
  showTrafficLights: boolean
  showAccidentPoints: boolean
  showConflicts: boolean
  showTrajectories: boolean
}

export interface SceneState {
  currentTime: number
  isPlaying: boolean
  playSpeed: number
  totalDuration: number
  viewMode: ViewMode
  filters: SceneFilters
  selectedElement: string | null
}

export interface SceneData {
  intersection: IntersectionGeometry
  signalPhases: SignalPhase[]
  vehicles: VehicleTrajectory[]
  pedestrians: PedestrianTrajectory[]
  accidentPoints: AccidentPoint[]
  totalDuration: number
}

export interface SceneStore extends SceneState {
  intersection: IntersectionGeometry | null
  signalPhases: SignalPhase[]
  vehicles: VehicleTrajectory[]
  pedestrians: PedestrianTrajectory[]
  accidentPoints: AccidentPoint[]
  conflicts: Conflict[]
  
  setCurrentTime: (time: number) => void
  setIsPlaying: (playing: boolean) => void
  setPlaySpeed: (speed: number) => void
  setTotalDuration: (duration: number) => void
  setViewMode: (mode: ViewMode) => void
  setFilters: (filters: Partial<SceneFilters>) => void
  setSelectedElement: (id: string | null) => void
  
  setIntersection: (intersection: IntersectionGeometry) => void
  setSignalPhases: (phases: SignalPhase[]) => void
  setVehicles: (vehicles: VehicleTrajectory[]) => void
  setPedestrians: (pedestrians: PedestrianTrajectory[]) => void
  setAccidentPoints: (points: AccidentPoint[]) => void
  setConflicts: (conflicts: Conflict[]) => void
  
  resetScene: () => void
  jumpToTime: (time: number) => void
}
