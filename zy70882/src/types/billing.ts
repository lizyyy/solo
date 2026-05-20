export interface BillingCalculationInput {
  contractId: string;
  zoneId: string;
  periodStart: Date;
  periodEnd: Date;
}

export interface BillingResult {
  totalConsumption: number;
  totalCost: number;
  breakdown: {
    electricity: number;
    baseRent: number;
    overtimeSurcharge: number;
  };
  anomalies: number;
}
