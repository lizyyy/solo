
export enum CrackLevel {
  LIGHT = 'light',
  MODERATE = 'moderate',
  SEVERE = 'severe',
}

export enum RecheckStatus {
  PENDING = 'pending',
  VERIFIED = 'verified',
  RESOLVED = 'resolved',
}

export interface Annotation {
  id: string;
  position: [number, number, number];
  crackLevel: CrackLevel;
  recheckStatus: RecheckStatus;
  photoUrl: string;
  photoOrientation: number;
  description: string;
  timestamp: number;
}

export interface FlightPoint {
  position: [number, number, number];
  timestamp: number;
  cameraAngle: [number, number, number];
}

export interface InspectionData {
  bladeId: string;
  annotations: Annotation[];
  flightPath: FlightPoint[];
  startTime: number;
  endTime: number;
}

export interface CameraPreset {
  id: string;
  name: string;
  position: [number, number, number];
  target: [number, number, number];
}

export interface ReportData {
  bladeId: string;
  exportTime: number;
  cameraPosition: [number, number, number];
  cameraTarget: [number, number, number];
  currentTime: number;
  timeRange: [number, number];
  filterLevel: CrackLevel[];
  filterStatus: RecheckStatus[];
  annotations: Annotation[];
}
