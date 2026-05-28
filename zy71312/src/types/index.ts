export interface City {
  name: string;
  latitude: number;
  longitude: number;
}

export interface SolarComponent {
  brand: string;
  model: string;
  power: number;
  efficiency: number;
  price: number;
}

export interface ShadingPeriod {
  id: string;
  startHour: number;
  endHour: number;
  description: string;
}

export interface SeasonWeights {
  spring: number;
  summer: number;
  autumn: number;
  winter: number;
}

export interface Scenario {
  id: string;
  name: string;
  createdAt: number;
  params: SolarParams;
  results: SolarResults;
}

export interface SolarParams {
  city: string;
  latitude: number;
  roofAngle: number;
  roofAzimuth: number;
  shadingPeriods: ShadingPeriod[];
  panelPower: number;
  panelCount: number;
  panelEfficiency: number;
  panelPrice: number;
  electricityPrice: number;
  seasonWeights: SeasonWeights;
  customAngle?: number;
}

export interface SolarResults {
  optimalAngle: number;
  optimalAngleReason: string;
  annualEnergy: number;
  shadingLoss: number;
  shadingLossReason: string;
  annualProfit: number;
  paybackYears: number;
  monthlyEnergy: number[];
  hourlyEnergy: number[];
}

export interface Warnings {
  latitudeWarning?: string;
  shadingWarning?: string;
  seasonWeightsWarning?: string;
}

export type OptimizationStrategy = 'yearly' | 'winter' | 'summer';
