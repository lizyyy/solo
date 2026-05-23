export interface Vehicle {
  vehicleId: string;
  plateNumber: string;
  model: string;
  standardFuelConsumption: number;
  driverId: string;
  originalRow: number;
}

export interface FuelRecord {
  recordId: string;
  vehicleId: string;
  date: string;
  fuelAmount: number;
  fuelType: string;
  price: number;
  gasStation: string;
  originalRow: number;
}

export interface MileageRecord {
  recordId: string;
  vehicleId: string;
  date: string;
  startMileage: number;
  endMileage: number;
  distance: number;
  routeId: string;
  originalRow: number;
}

export interface Driver {
  driverId: string;
  name: string;
  phone: string;
  licenseNumber: string;
  originalRow: number;
}

export interface Route {
  routeId: string;
  routeName: string;
  startLocation: string;
  endLocation: string;
  standardDistance: number;
  originalRow: number;
}

export interface BadRecord {
  type: string;
  originalRow: number;
  rawData: string;
  error: string;
}

export interface VehicleFuelSummary {
  vehicleId: string;
  plateNumber: string;
  driverName: string;
  totalFuel: number;
  totalDistance: number;
  fuelConsumptionPer100km: number;
  standardFuelConsumption: number;
  deviation: number;
  deviationPercent: number;
}

export enum AbnormalLevel {
  NORMAL = 'normal',
  WARNING = 'warning',
  SEVERE = 'severe',
  CRITICAL = 'critical'
}

export interface AbnormalRecord {
  vehicleId: string;
  plateNumber: string;
  driverName: string;
  abnormalType: string;
  description: string;
  level: AbnormalLevel;
  fuelConsumptionPer100km: number;
  standardFuelConsumption: number;
  deviation: number;
  deviationPercent: number;
  totalFuel: number;
  totalDistance: number;
  routeId?: string;
  routeName?: string;
  relatedRecords: {
    fuelRecords: number[];
    mileageRecords: number[];
  };
}

export interface AnalysisResult {
  summary: {
    totalVehicles: number;
    totalFuelRecords: number;
    totalMileageRecords: number;
    totalBadRecords: number;
    abnormalVehicles: number;
    averageFuelConsumption: number;
  };
  badRecords: BadRecord[];
  vehicleSummaries: VehicleFuelSummary[];
  abnormalRecords: AbnormalRecord[];
  routeGroups: Map<string, {
    routeName: string;
    vehicles: VehicleFuelSummary[];
    averageFuelConsumption: number;
  }>;
}

export interface CliOptions {
  vehicles: string;
  fuel: string;
  mileage: string;
  drivers: string;
  routes: string;
  output: string;
  warningThreshold: number;
  severeThreshold: number;
  criticalThreshold: number;
}
