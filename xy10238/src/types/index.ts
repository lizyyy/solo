export interface HouseType {
  id: string;
  name: string;
  area: number;
  insulationLevel: 'poor' | 'medium' | 'good';
  floorCount: number;
  buildingAge: number;
  location: string;
  normalizedFactor: number;
}

export interface ElectricityPrice {
  id: string;
  name: string;
  pricePerKWh: number;
  tier: string;
  hasTimeOfUse: boolean;
  peakPrice: number;
  offPeakPrice: number;
  timeZone: string;
}

export interface WeatherData {
  id: string;
  houseTypeId: string;
  month: number;
  year: number;
  avgOutdoorTemp: number;
  heatingDegreeDays: number;
  solarRadiation: number;
  windSpeed: number;
}

export interface EnergyConsumption {
  id: string;
  houseTypeId: string;
  electricityPriceId: string;
  weatherDataId: string;
  month: number;
  year: number;
  kWhConsumed: number;
  targetRoomTemp: number;
  isConfirmed: boolean;
  hasError: boolean;
  errorMessage?: string;
  normalizedConsumption?: number;
  weatherCorrectedConsumption?: number;
  weatherCorrectionFactor?: number;
  estimatedCost?: number;
  dataSource: 'imported' | 'manual';
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  type: 'duplicate' | 'missing' | 'manual_error' | 'invalid';
  field: string;
  message: string;
  value?: string | number;
  rowIndex?: number;
}

export interface ValidationWarning {
  type: 'outlier' | 'weather_anomaly' | 'price_mismatch';
  field: string;
  message: string;
  value?: string | number;
}

export interface EnergyComparison {
  id: string;
  name: string;
  houseTypeIds: string[];
  priceIds: string[];
  createdDate: Date;
  results: ComparisonResult[];
}

export interface ComparisonResult {
  houseTypeId: string;
  houseTypeName: string;
  priceId: string;
  priceName: string;
  annualConsumption: number;
  annualCost: number;
  avgMonthlyConsumption: number;
  weatherCorrectionSummary: string;
  potentialSavings?: number;
}
