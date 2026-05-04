export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface StudioDimensions {
  width: number;
  depth: number;
  height: number;
}

export interface LightFixture {
  id: string;
  name: string;
  type: string;
  power: number;
  colorTemp: number;
  dmxChannel: number;
  isHighTemp: boolean;
}

export interface PlacedLight extends LightFixture {
  position: Vec3;
  rotation: Vec3;
  intensity: number;
  color: string;
  standHeight: number;
  notes: string;
}

export interface Actor {
  id: string;
  name: string;
  position: Vec3;
  rotation: Vec3;
  walkPath?: Vec3[];
}

export interface Camera {
  id: string;
  name: string;
  position: Vec3;
  rotation: Vec3;
  lens: string;
  fov: number;
}

export interface ScheduleItem {
  id: string;
  sceneId: string;
  sceneName: string;
  startTime: string;
  endTime: string;
  date: string;
  lightIds: string[];
  cameraIds: string[];
  actorIds: string[];
  notes: string;
}

export interface LightingPlan {
  id: string;
  name: string;
  description: string;
  studioDimensions: StudioDimensions;
  createdAt: string;
  updatedAt: string;
  totalPower: number;
  maxPowerLimit: number;
}

export interface RiskItem {
  id: string;
  planId: string;
  type: RiskType;
  severity: RiskSeverity;
  title: string;
  description: string;
  affectedItems: string[];
  isOverridden: boolean;
  overrideReason: string;
  overrideBy: string;
  createdAt: string;
}

export type RiskType = 
  | 'power_overload' 
  | 'light_stand_blocking' 
  | 'actor_near_high_temp' 
  | 'light_schedule_conflict' 
  | 'other';

export type RiskSeverity = 'critical' | 'high' | 'medium' | 'low';

export interface ImportResult {
  success: boolean;
  data: any;
  errors: string[];
}

export interface ExportPackage {
  plan: LightingPlan;
  lights: PlacedLight[];
  actors: Actor[];
  cameras: Camera[];
  schedule: ScheduleItem[];
  risks: RiskItem[];
  exportedAt: string;
  version: string;
}
