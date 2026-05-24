import { RackStatus, AlertLevel } from '../types';

export const STATUS_COLORS: Record<RackStatus, string> = {
  normal: '#00d2d3',
  warning: '#feca57',
  critical: '#ff4757',
  offline: '#576574',
};

export const ALERT_COLORS: Record<AlertLevel, string> = {
  info: '#54a0ff',
  warning: '#feca57',
  critical: '#ff4757',
};

export function getHeatColor(value: number, min: number = 20, max: number = 60): string {
  const normalized = Math.max(0, Math.min(1, (value - min) / (max - min)));
  
  const r = Math.round(normalized * 255);
  const g = Math.round((1 - Math.abs(normalized - 0.5) * 2) * 200);
  const b = Math.round((1 - normalized) * 200);
  
  return `rgb(${r}, ${g}, ${b})`;
}

export function powerToTemperatureColor(power: number): string {
  const temp = 22 + power * 0.35;
  return getHeatColor(temp, 22, 55);
}

export const THEME = {
  background: '#0a1628',
  panelBg: 'rgba(10, 22, 40, 0.85)',
  panelBorder: 'rgba(0, 210, 211, 0.2)',
  textPrimary: '#ffffff',
  textSecondary: '#a0aec0',
  accent: '#00d2d3',
  accentHover: '#00b5b6',
  danger: '#ff4757',
  warning: '#feca57',
  success: '#00d2d3',
  offline: '#576574',
};
