export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface Light {
  id: string;
  name: string;
  type: 'spot' | 'par' | 'moving';
  position: Vector3;
  target: Vector3;
  beamAngle: number;
  intensity: number;
  color: string;
  enabled: boolean;
  group: string;
}

export interface ProgramSegment {
  id: string;
  name: string;
  startTime: number;
  endTime: number;
  lightStates: LightState[];
}

export interface LightState {
  lightId: string;
  position: Vector3;
  target: Vector3;
  intensity: number;
}

export interface ForbiddenZone {
  id: string;
  name: string;
  type: 'audience' | 'subtitle';
  bounds: {
    min: Vector3;
    max: Vector3;
  };
  color: string;
}

export interface CollisionWarning {
  id: string;
  lightId: string;
  lightName: string;
  zoneId: string;
  zoneName: string;
  zoneType: 'audience' | 'subtitle';
  severity: 'warning' | 'danger';
  timestamp: number;
  message: string;
}

export interface SceneState {
  lights: Light[];
  forbiddenZones: ForbiddenZone[];
  selectedLightId: string | null;
  filters: {
    group: string;
    search: string;
  };
  collisionWarnings: CollisionWarning[];
  currentTime: number;
  isPlaying: boolean;
  programSegments: ProgramSegment[];
  currentSegmentId: string | null;
  cameraView: 'front' | 'top' | 'side' | 'free';
}

export interface SceneData {
  lights: Light[];
  forbiddenZones: ForbiddenZone[];
  programSegments: ProgramSegment[];
  filters: {
    group: string;
    search: string;
  };
  version: string;
  exportedAt: string;
}
