const temperatureUnits = ['°C', '°F', 'K', 'C', 'F', '摄氏度', '华氏度'];
const areaUnits = ['m²', 'ft²', '㎡', '平方英尺', '平方米'];
const heatLossUnits = ['W', 'kW', 'kWh/d', '瓦', '千瓦'];

export function normalizeTemperatureUnit(unit: string): string {
  const u = unit.trim().toLowerCase();
  if (u.includes('f') || u.includes('华氏')) return '°F';
  if (u.includes('k')) return 'K';
  return '°C';
}

export function normalizeAreaUnit(unit: string): string {
  const u = unit.trim().toLowerCase();
  if (u.includes('ft') || u.includes('平方英尺')) return 'ft²';
  return 'm²';
}

export function normalizeHeatLossUnit(unit: string): string {
  const u = unit.trim().toLowerCase();
  if (u.includes('kwh') || u.includes('kwh/d')) return 'kWh/d';
  if (u.includes('kw') || u.includes('千瓦')) return 'kW';
  return 'W';
}

export function toCelsius(value: number, unit: string): number {
  const normalized = normalizeTemperatureUnit(unit);
  switch (normalized) {
    case '°F':
      return (value - 32) * 5 / 9;
    case 'K':
      return value - 273.15;
    default:
      return value;
  }
}

export function toSquareMeters(value: number, unit: string): number {
  const normalized = normalizeAreaUnit(unit);
  if (normalized === 'ft²') {
    return value * 0.092903;
  }
  return value;
}

export function toWatts(value: number, unit: string): number {
  const normalized = normalizeHeatLossUnit(unit);
  switch (normalized) {
    case 'kW':
      return value * 1000;
    case 'kWh/d':
      return (value * 1000) / 24;
    default:
      return value;
  }
}

export function fromWatts(value: number, targetUnit: string): number {
  const normalized = normalizeHeatLossUnit(targetUnit);
  switch (normalized) {
    case 'kW':
      return value / 1000;
    case 'kWh/d':
      return (value * 24) / 1000;
    default:
      return value;
  }
}

export function detectTemperatureUnit(raw: string): string {
  const r = raw.toLowerCase().trim();
  if (r.includes('f') || r.includes('华氏')) return '°F';
  if (r.includes('k')) return 'K';
  return '°C';
}

export function isKnownUnit(value: string, type: 'temperature' | 'area' | 'heatLoss'): boolean {
  const v = value.trim().toLowerCase();
  switch (type) {
    case 'temperature':
      return temperatureUnits.some(u => u.toLowerCase().includes(v) || v.includes(u.toLowerCase()));
    case 'area':
      return areaUnits.some(u => u.toLowerCase().includes(v) || v.includes(u.toLowerCase()));
    case 'heatLoss':
      return heatLossUnits.some(u => u.toLowerCase().includes(v) || v.includes(u.toLowerCase()));
  }
}
