export interface DMS {
  degrees: number;
  minutes: number;
  seconds: number;
}

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface Lighthouse {
  id: string;
  name: string;
  position: GeoPoint;
  signal: string;
  color: string;
  range: number;
}

export interface BearingData {
  lighthouseId: string;
  degrees: number;
  minutes: number;
  seconds: number;
  decimalDegrees: number;
  unit: 'dms' | 'decimal';
  hasUnitError: boolean;
  inputTime: Date;
  source: string;
  modifyHistory: {
    timestamp: Date;
    oldValue: number;
    newValue: number;
  }[];
}

export interface BearingLine {
  lighthouseId: string;
  start: GeoPoint;
  end: GeoPoint;
  bearing: number;
  color: string;
}

export interface IntersectionPoint {
  position: GeoPoint;
  line1: string;
  line2: string;
}

export interface PositionMark {
  id: string;
  position: GeoPoint;
  confidence: number;
  markedTime: Date;
  adjustHistory: {
    timestamp: Date;
    oldPosition: GeoPoint;
    newPosition: GeoPoint;
  }[];
}

export interface RouteOption {
  id: string;
  name: string;
  start: GeoPoint;
  end: GeoPoint;
  waypoints: GeoPoint[];
  distance: number;
  estimatedTime: number;
  riskLevel: 'low' | 'medium' | 'high';
  riskDescription: string;
}

export interface SelectedRoute {
  routeId: string;
  decisionReason: string;
  selectedTime: Date;
}

export interface TriangleData {
  vertices: GeoPoint[];
  area: number;
  centroid: GeoPoint;
  errorLevel: 'excellent' | 'good' | 'fair' | 'poor';
}
