export interface Point {
  x: number;
  y: number;
}

export interface Zone {
  id: string;
  name: string;
  points: Point[];
  floorId: string;
}

export interface Floor {
  id: string;
  name: string;
  level: number;
  zones: Zone[];
}

export interface SensorReading {
  sensorId: string;
  timestamp: number;
  temperature: number;
  humidity: number;
  isOnline: boolean;
}

export interface Sensor {
  id: string;
  name: string;
  floorId: string;
  zoneId: string;
  x: number;
  y: number;
  readings: SensorReading[];
}

export interface WorkOrder {
  id: string;
  title: string;
  description: string;
  floorId: string;
  zoneId: string;
  sensorId?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'critical';
  createdAt: number;
  assignedTo: string;
  assigneeId: string;
}

export interface Thresholds {
  temperatureMin: number;
  temperatureMax: number;
  humidityMin: number;
  humidityMax: number;
}

export interface Alert {
  id: string;
  type: 'continuous_threshold' | 'sensor_offline' | 'repeated_dispatch';
  severity: 'warning' | 'error' | 'critical';
  title: string;
  description: string;
  sensorId?: string;
  zoneId?: string;
  floorId: string;
  relatedWorkOrders?: string[];
  relatedSensorIds?: string[];
  timestamp: number;
  data: {
    continuousDuration?: number;
    offlineDuration?: number;
    dispatchCount?: number;
    assignees?: string[];
  };
}

export interface TimeRange {
  start: number;
  end: number;
}

export interface InspectionSuggestion {
  id: string;
  floorId: string;
  zoneId: string;
  sensorId?: string;
  issueType: string;
  priority: 'high' | 'medium' | 'low';
  suggestion: string;
  relatedData: Record<string, unknown>;
}
