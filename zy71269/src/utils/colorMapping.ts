import { temperatureColors } from '../data/mockData';

export const getTemperatureColor = (
  temperature: number,
  minTemp: number,
  maxTemp: number
): string => {
  if (maxTemp === minTemp) return temperatureColors[0];
  
  const normalized = Math.max(0, Math.min(1, (temperature - minTemp) / (maxTemp - minTemp)));
  const index = Math.floor(normalized * (temperatureColors.length - 1));
  return temperatureColors[index];
};

export const hexToRgb = (hex: string): { r: number; g: number; b: number } => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16) / 255,
    g: parseInt(result[2], 16) / 255,
    b: parseInt(result[3], 16) / 255
  } : { r: 0, g: 0, b: 0 };
};

export const createTemperatureGradient = (
  minTemp: number,
  maxTemp: number
): string => {
  const steps = temperatureColors.length;
  const colors = temperatureColors.map((color, i) => {
    const position = (i / (steps - 1)) * 100;
    return `${color} ${position}%`;
  });
  return `linear-gradient(to top, ${colors.join(', ')})`;
};
