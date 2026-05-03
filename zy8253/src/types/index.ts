export interface Cabinet {
  cabinetId: string;
  location: string;
  totalSlots: number;
  installedAt: string;
}

export interface CabinetsConfig {
  cabinets: Cabinet[];
}

export interface SlotTemperature {
  timestamp: string;
  cabinetId: string;
  slotId: number;
  temperature: number | null;
}

export interface SwapEvent {
  eventId: string;
  timestamp: string;
  cabinetId: string;
  slotId: number;
  batteryId: string;
  eventType: 'in' | 'out';
  operatorId?: string;
}

export interface BatteryRegistry {
  batteryId: string;
  model: string;
  manufacturer: string;
  productionDate: string;
  capacity: number;
  status: 'active' | 'retired' | 'maintenance';
}

export interface AlertRule {
  ruleId: string;
  name: string;
  type: 'temperature_slope' | 'abnormal_swap' | 'sensor_failure';
  threshold: number;
  timeWindowMinutes: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  enabled: boolean;
}

export interface RulesConfig {
  rules: AlertRule[];
  globalSettings: {
    maxGapMinutes: number;
    duplicateBatteryMinutes: number;
  };
}

export interface BatterySlotSession {
  batteryId: string;
  cabinetId: string;
  slotId: number;
  inTime: Date;
  outTime?: Date;
  temperatures: SlotTemperature[];
  temperatureSlope?: number;
  maxTemperature?: number;
  minTemperature?: number;
  avgTemperature?: number;
  hasSensorGap: boolean;
  sensorGapMinutes: number;
}

export interface RiskItem {
  riskId: string;
  batteryId: string;
  cabinetId: string;
  slotId: number;
  riskType: 'temperature_anomaly' | 'abnormal_swap' | 'sensor_failure' | 'alert_not_closed';
  severity: 'low' | 'medium' | 'high' | 'critical';
  startTime: string;
  endTime?: string;
  description: string;
  relatedEventIds: string[];
  temperatureSlope?: number;
  maxTemperature?: number;
  status: 'open' | 'investigating' | 'closed';
  closedBy?: string;
  closedAt?: string;
}

export interface Alert {
  alertId: string;
  ruleId: string;
  batteryId: string;
  cabinetId: string;
  slotId: number;
  startTime: Date;
  endTime?: Date;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'active' | 'acknowledged' | 'resolved' | 'closed';
  closedBy?: string;
  closedAt?: Date;
}

export interface ValidationError {
  field: string;
  message: string;
  value?: unknown;
  rowNumber?: number;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
  stats: {
    totalCabinets: number;
    totalTemperatureRecords: number;
    totalSwapEvents: number;
    totalBatteries: number;
    totalRules: number;
  };
}

export interface AnalysisResult {
  batterySessions: BatterySlotSession[];
  riskItems: RiskItem[];
  alerts: Alert[];
  summary: {
    totalSessions: number;
    totalRisks: number;
    risksByType: Record<string, number>;
    risksBySeverity: Record<string, number>;
    alertsClosed: number;
    alertsOpen: number;
  };
}

export interface DataFiles {
  cabinets: CabinetsConfig;
  temperatures: SlotTemperature[];
  swapEvents: SwapEvent[];
  batteryRegistry: BatteryRegistry[];
  rules: RulesConfig;
}
