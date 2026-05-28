export interface Scene {
  id: string
  name: string
  createdAt: number
  stageWidth: number
  stageDepth: number
  stageHeight: number
}

export interface Light {
  id: string
  name: string
  type: 'spot' | 'point' | 'directional'
  positionX: number
  positionY: number
  positionZ: number
  targetX: number
  targetY: number
  targetZ: number
  colorTemp: number
  intensity: number
  angle: number
  penumbra: number
  sourceFile?: string
  sourceLine?: number
}

export interface Actor {
  id: string
  name: string
  height: number
  color: string
  sourceFile?: string
  sourceLine?: number
}

export interface Prop {
  id: string
  name: string
  type: 'box' | 'sphere' | 'cylinder' | 'plane'
  positionX: number
  positionY: number
  positionZ: number
  rotationX: number
  rotationY: number
  rotationZ: number
  scaleX: number
  scaleY: number
  scaleZ: number
  occluder: boolean
  sourceFile?: string
  sourceLine?: number
}

export interface Waypoint {
  time: number
  x: number
  y: number
  z: number
}

export interface Trajectory {
  id: string
  name: string
  actorId: string
  waypoints: Waypoint[]
  sourceFile?: string
  sourceLine?: number
}

export type ValidationSeverity = 'error' | 'warning' | 'info'

export interface ValidationResult {
  id: string
  severity: ValidationSeverity
  type: string
  message: string
  sourceFile?: string
  sourceLine?: number
  relatedElementId?: string
}

export interface OcclusionResult {
  lightId: string
  propId: string
  intersectionPoint: { x: number; y: number; z: number }
}

export interface ActorLightStatus {
  actorId: string
  inLightCone: boolean
  illuminatingLights: string[]
}

export type ElementType = 'light' | 'actor' | 'prop' | 'trajectory'

export interface SelectedElement {
  type: ElementType
  id: string
}

export interface FilterState {
  lights: boolean
  actors: boolean
  props: boolean
  trajectories: boolean
  selectedTypes: string[]
}

export interface PlaybackState {
  isPlaying: boolean
  currentTime: number
  duration: number
  speed: number
}

export interface ProjectState {
  scene: Scene
  lights: Light[]
  actors: Actor[]
  props: Prop[]
  trajectories: Trajectory[]
  validationResults: ValidationResult[]
  occlusionResults: OcclusionResult[]
  actorLightStatus: ActorLightStatus[]
  selectedElement: SelectedElement | null
  filters: FilterState
  playback: PlaybackState
  importedFiles: string[]
}

export interface SavedProject {
  id: string
  name: string
  savedAt: number
  state: ProjectState
  thumbnail?: string
}
