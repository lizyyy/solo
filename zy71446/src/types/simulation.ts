export interface SimulationState {
  currentTime: string;
  isPlaying: boolean;
  playSpeed: number;
  startTime: string;
  endTime: string;
}

export interface CrowdDataPoint {
  zoneId: string;
  count: number;
  density: number;
  flowIn: number;
  flowOut: number;
  timestamp: string;
}

export interface Zone {
  id: string;
  name: string;
  type: 'concourse' | 'platform' | 'escalator' | 'turnstile' | 'corridor';
  capacity: number;
  maxCapacity?: number;
  position: [number, number, number];
  size: [number, number, number];
}

export interface DeviceStatus {
  deviceId: string;
  status: string;
  throughput: number;
  direction?: string;
  timestamp: string;
}

export interface PeakHourConfig {
  startTime: string;
  endTime: string;
  expectedEscalatorDirection: 'up' | 'down';
}
