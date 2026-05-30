export interface Vector3 {
  x: number
  y: number
  z: number
}

export type FixtureType = "spotlight" | "fresnel" | "led_par" | "moving_head"
export type CollisionType = "view_obstruction" | "overload" | "route_collision"
export type Severity = "warning" | "critical"

export interface StagePlatform {
  width: number
  depth: number
  height: number
  gridUnit: number
}

export interface LightBar {
  id: string
  name: string
  position: Vector3
  length: number
  sourceRef: string
}

export interface HangingPoint {
  id: string
  name: string
  position: Vector3
  loadCapacity: number
  currentLoad: number
  sourceRef: string
}

export interface Fixture {
  id: string
  name: string
  type: FixtureType
  position: Vector3
  targetPosition: Vector3
  beamAngle: number
  weight: number
  attachedTo: string
  sourceRef: string
}

export interface ActorRoute {
  id: string
  name: string
  scene: string
  waypoints: Vector3[]
  actorHeight: number
  sourceRef: string
}

export interface Collision {
  id: string
  type: CollisionType
  severity: Severity
  involvedElements: string[]
  description: string
  position: Vector3
  resolved: boolean
  resolution?: string
}

export interface AuditLog {
  id: string
  timestamp: string
  operator: string
  elementType: string
  elementId: string
  field: string
  oldValue: unknown
  newValue: unknown
  reason: string
}

export interface StageScene {
  id: string
  name: string
  version: number
  createdAt: string
  updatedAt: string
  source: string
  stage: StagePlatform
  lightBars: LightBar[]
  hangingPoints: HangingPoint[]
  fixtures: Fixture[]
  actorRoutes: ActorRoute[]
  collisions: Collision[]
  auditLogs: AuditLog[]
}

export type ElementType = "lightBar" | "hangingPoint" | "fixture" | "actorRoute"

export interface SelectedElement {
  type: ElementType
  id: string
}
