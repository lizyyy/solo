export const convertDistance = (value: number, from: 'km' | 'm' | 'miles', to: 'km' | 'm' | 'miles'): number => {
  const toMeters: Record<string, number> = { km: 1000, m: 1, miles: 1609.34 };
  const fromMeters: Record<string, number> = { km: 1 / 1000, m: 1, miles: 1 / 1609.34 };
  return value * toMeters[from] * fromMeters[to];
};

export const convertTime = (value: number, from: 's' | 'ms' | 'min', to: 's' | 'ms' | 'min'): number => {
  const toSeconds: Record<string, number> = { s: 1, ms: 0.001, min: 60 };
  const fromSeconds: Record<string, number> = { s: 1, ms: 1000, min: 1 / 60 };
  return value * toSeconds[from] * fromSeconds[to];
};

export const convertVelocity = (value: number, from: 'km/s' | 'm/s' | 'km/h', to: 'km/s' | 'm/s' | 'km/h'): number => {
  const toMetersPerSecond: Record<string, number> = { 'km/s': 1000, 'm/s': 1, 'km/h': 1 / 3.6 };
  const fromMetersPerSecond: Record<string, number> = { 'km/s': 1 / 1000, 'm/s': 1, 'km/h': 3.6 };
  return value * toMetersPerSecond[from] * fromMetersPerSecond[to];
};

export const convertDepth = (value: number, from: 'km' | 'm', to: 'km' | 'm'): number => {
  return convertDistance(value, from, to);
};

export const formatNumber = (num: number, decimals: number = 4): string => {
  return num.toFixed(decimals);
};

export const formatCoordinate = (lat: number, lng: number): string => {
  const latDir = lat >= 0 ? 'N' : 'S';
  const lngDir = lng >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(4)}°${latDir}, ${Math.abs(lng).toFixed(4)}°${lngDir}`;
};
