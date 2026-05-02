export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface StageDimensions {
  width: number;
  depth: number;
  height: number;
  prosceniumWidth: number;
  prosceniumHeight: number;
  stageType: 'proscenium' | 'arena' | 'thrust' | 'blackBox';
}

export interface Rig {
  id: string;
  name: string;
  type: 'batten' | 'truss' | 'pipe' | 'motorizedBatten';
  position: Vector3;
  length: number;
  width: number;
  currentHeight: number;
  targetHeight?: number;
  weight: number;
  maxLoad: number;
  motorized: boolean;
}

export interface LightType {
  id: string;
  name: string;
  wattage: number;
  intensity: number;
  beamAngle: number;
  fieldAngle: number;
  colorTemperature: number;
  dmxChannels: number;
}

export interface LightFixture {
  id: string;
  name: string;
  type: LightType;
  rigId: string;
  positionOnRig: number;
  pan: number;
  tilt: number;
  intensity: number;
  color: { r: number; g: number; b: number };
  dmxAddress: number;
  dmxUniverse: number;
}

export interface Actor {
  id: string;
  name: string;
  height: number;
  radius: number;
}

export interface TimelineKeyframe {
  time: number;
  position: Vector3;
  rotation?: number;
  note?: string;
}

export interface ActorTimeline {
  actorId: string;
  keyframes: TimelineKeyframe[];
}

export interface RigTimeline {
  rigId: string;
  keyframes: { time: number; height: number; note?: string }[];
}

export interface LightTimeline {
  lightId: string;
  keyframes: {
    time: number;
    pan?: number;
    tilt?: number;
    intensity?: number;
    color?: { r: number; g: number; b: number };
    note?: string;
  }[];
}

export interface RestrictedZone {
  id: string;
  name: string;
  type: 'noEntry' | 'heightLimit' | 'fireExit' | 'techArea';
  bounds: {
    min: Vector3;
    max: Vector3;
  };
  maxHeight?: number;
}

export interface Scene {
  id: string;
  name: string;
  startTime: number;
  endTime: number;
  description: string;
}

export interface StageProject {
  id: string;
  name: string;
  created: Date;
  modified: Date;
  stage: StageDimensions;
  rigs: Rig[];
  lightTypes: LightType[];
  lights: LightFixture[];
  actors: Actor[];
  actorTimelines: ActorTimeline[];
  rigTimelines: RigTimeline[];
  lightTimelines: LightTimeline[];
  restrictedZones: RestrictedZone[];
  scenes: Scene[];
  targetMinLux: number;
}

export type RiskLevel = 'critical' | 'warning' | 'info';

export interface Risk {
  id: string;
  type: 'collision' | 'occlusion' | 'illumination' | 'height';
  level: RiskLevel;
  time: number;
  sceneId?: string;
  description: string;
  involvedObjects: string[];
  location: Vector3;
  suggestedFix?: string;
}

export interface ProjectAdjustment {
  id: string;
  timestamp: Date;
  type: 'lightAngle' | 'rigHeight' | 'intensity';
  targetId: string;
  oldValue: number | { pan: number; tilt: number };
  newValue: number | { pan: number; tilt: number };
  reason: string;
}
