export const convertFeetToMeters = (feet: number): number => feet * 0.3048;
export const convertMetersToFeet = (meters: number): number => meters / 0.3048;

export const convertKnotsToMetersPerSecond = (knots: number): number => knots * 0.514444;
export const convertMetersPerSecondToKnots = (mps: number): number => mps / 0.514444;

export const convertSquareFeetToSquareMeters = (sqft: number): number => sqft * 0.092903;
export const convertSquareMetersToSquareFeet = (sqm: number): number => sqm / 0.092903;

export const normalizeToMetric = (value: number, unit: string): number => {
  switch (unit) {
    case 'ft':
      return convertFeetToMeters(value);
    case 'knots':
      return convertKnotsToMetersPerSecond(value);
    case 'ft²':
      return convertSquareFeetToSquareMeters(value);
    case 'm':
    case 'm/s':
    case 'm²':
    default:
      return value;
  }
};

export const formatNumber = (num: number, decimals: number = 2): string => {
  return num.toLocaleString('zh-CN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
};

export const formatEnergy = (kwh: number): string => {
  if (kwh >= 1000000) {
    return `${formatNumber(kwh / 1000000, 2)} GWh`;
  }
  if (kwh >= 1000) {
    return `${formatNumber(kwh / 1000, 2)} MWh`;
  }
  return `${formatNumber(kwh, 2)} kWh`;
};

export const formatPower = (kw: number): string => {
  if (kw >= 1000) {
    return `${formatNumber(kw / 1000, 2)} MW`;
  }
  return `${formatNumber(kw, 2)} kW`;
};
