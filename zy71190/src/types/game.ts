export type ZoneType = "pickup" | "dropoff" | "restricted" | "personnel";

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface Vec2 {
  x: number;
  y: number;
}

export interface CoilConfig {
  id: string;
  position: Vec3;
  radius: number;
  length: number;
  weight: number;
  centerOffset: Vec2;
  targetZoneId: string;
}

export interface ZoneConfig {
  id: string;
  position: Vec3;
  size: Vec3;
  type: ZoneType;
  label?: string;
}

export interface RailConfig {
  id: string;
  axis: "x" | "z";
  start: number;
  end: number;
  fixed: number;
  y: number;
}

export interface CraneConfig {
  id: string;
  railId: string;
  axis: "x" | "z";
  start: number;
  end: number;
  fixed: number;
  y: number;
  speed: number;
  hoistSpeed: number;
  width: number;
}

export interface LevelConfig {
  id: string;
  name: string;
  description: string;
  difficulty: number;
  maxTiltDegrees: number;
  maxMoves: number;
  timeLimit: number;
  coils: CoilConfig[];
  zones: ZoneConfig[];
  rails: RailConfig[];
  cranes: CraneConfig[];
  boundary: { minX: number; maxX: number; minZ: number; maxZ: number };
}

export type GameStatus =
  | "idle"
  | "planning"
  | "running"
  | "paused"
  | "success"
  | "failed";

export type EventType =
  | "center_of_mass"
  | "rail_conflict"
  | "zone_collision"
  | "personnel_cross"
  | "wrong_zone"
  | "success"
  | "info";

export interface GameEvent {
  id: string;
  frame: number;
  time: number;
  type: EventType;
  severity: "warning" | "critical" | "success" | "info";
  detail: string;
  position?: Vec3;
}

export interface Snapshot {
  frame: number;
  time: number;
  cranePositions: Record<string, { x: number; z: number; y: number }>;
  coilPositions: Record<string, { x: number; y: number; z: number; tilt: number; tiltAxis: Vec2 }>;
  currentCoilId: string | null;
  phase: string;
  status: GameStatus;
}

export interface GameSession {
  id: string;
  levelId: string;
  startedAt: number;
  status: GameStatus;
  score: number;
  movesUsed: number;
  events: GameEvent[];
  snapshots: Snapshot[];
  totalFrames: number;
  failureReason?: string;
  failureType?: EventType;
}
