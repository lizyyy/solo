import type { SensorData, UnitMixingInfo } from '../types';

export class TemperatureUnitDetector {
  static detectMixing(data: SensorData[]): UnitMixingInfo {
    const celsiusRows = data.filter(d => d.temperatureUnit === 'C');
    const kelvinRows = data.filter(d => d.temperatureUnit === 'K');
    
    const hasMixing = celsiusRows.length > 0 && kelvinRows.length > 0;
    
    return {
      hasMixing,
      celsiusCount: celsiusRows.length,
      kelvinCount: kelvinRows.length,
      affectedRows: hasMixing ? kelvinRows.map(r => r.id) : [],
    };
  }

  static kelvinToCelsius(kelvin: number): number {
    return Math.round((kelvin - 273.15) * 100) / 100;
  }

  static celsiusToKelvin(celsius: number): number {
    return Math.round((celsius + 273.15) * 100) / 100;
  }

  static suggestConversion(data: SensorData[]): SensorData[] {
    return data.map(row => {
      if (row.temperatureUnit === 'K') {
        return {
          ...row,
          temperature: this.kelvinToCelsius(row.temperature),
          temperatureUnit: 'C' as const,
        };
      }
      return row;
    });
  }

  static markForReview(data: SensorData[]): SensorData[] {
    const mixingInfo = this.detectMixing(data);
    if (!mixingInfo.hasMixing) return data;
    
    return data.map(row => ({
      ...row,
      needsReview: mixingInfo.affectedRows.includes(row.id),
    }));
  }
}

export function formatTemperature(value: number, unit: 'C' | 'K'): string {
  const symbol = unit === 'C' ? '°C' : 'K';
  return `${value}${symbol}`;
}
