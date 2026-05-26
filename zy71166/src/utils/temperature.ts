import { PHYSICS_CONFIG } from '../engine/config';

const { WARNING_TEMP, DANGER_TEMP, FAULT_TEMP } = PHYSICS_CONFIG;

export function tempToColor(temp: number): string {
  const t = Math.max(18, Math.min(50, temp));

  if (t < 22) {
    return `rgb(59, 130, 246)`;
  } else if (t < 26) {
    const ratio = (t - 22) / 4;
    return interpolateColor([59, 130, 246], [20, 184, 166], ratio);
  } else if (t < 30) {
    const ratio = (t - 26) / 4;
    return interpolateColor([20, 184, 166], [34, 197, 94], ratio);
  } else if (t < WARNING_TEMP) {
    const ratio = (t - 30) / (WARNING_TEMP - 30);
    return interpolateColor([34, 197, 94], [234, 179, 8], ratio);
  } else if (t < DANGER_TEMP) {
    const ratio = (t - WARNING_TEMP) / (DANGER_TEMP - WARNING_TEMP);
    return interpolateColor([234, 179, 8], [249, 115, 22], ratio);
  } else if (t < FAULT_TEMP) {
    const ratio = (t - DANGER_TEMP) / (FAULT_TEMP - DANGER_TEMP);
    return interpolateColor([249, 115, 22], [239, 68, 68], ratio);
  } else {
    return `rgb(220, 38, 38)`;
  }
}

function interpolateColor(c1: number[], c2: number[], ratio: number): string {
  const r = Math.round(c1[0] + (c2[0] - c1[0]) * ratio);
  const g = Math.round(c1[1] + (c2[1] - c1[1]) * ratio);
  const b = Math.round(c1[2] + (c2[2] - c1[2]) * ratio);
  return `rgb(${r}, ${g}, ${b})`;
}

export function tempToHeatmapColor(temp: number): [number, number, number, number] {
  const colorStr = tempToColor(temp);
  const match = colorStr.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  if (match) {
    return [
      parseInt(match[1]) / 255,
      parseInt(match[2]) / 255,
      parseInt(match[3]) / 255,
      0.6,
    ];
  }
  return [0.5, 0.5, 0.5, 0.6];
}

export function getStatusColor(status: string): string {
  switch (status) {
    case 'normal':
      return 'text-green-400';
    case 'warning':
      return 'text-yellow-400';
    case 'danger':
      return 'text-orange-400';
    case 'fault':
      return 'text-red-500';
    case 'running':
      return 'text-green-400';
    case 'overload':
      return 'text-orange-400';
    case 'off':
      return 'text-slate-400';
    default:
      return 'text-slate-300';
  }
}

export function getStatusBgColor(status: string): string {
  switch (status) {
    case 'normal':
      return 'bg-green-500/20 border-green-500/50';
    case 'warning':
      return 'bg-yellow-500/20 border-yellow-500/50';
    case 'danger':
      return 'bg-orange-500/20 border-orange-500/50';
    case 'fault':
      return 'bg-red-500/30 border-red-500/50';
    case 'running':
      return 'bg-green-500/20 border-green-500/50';
    case 'overload':
      return 'bg-orange-500/20 border-orange-500/50';
    case 'off':
      return 'bg-slate-500/20 border-slate-500/50';
    default:
      return 'bg-slate-500/20 border-slate-500/50';
  }
}

export function formatHour(hour: number): string {
  return `${String(hour).padStart(2, '0')}:00`;
}

export function getPricePeriodLabel(period: string): string {
  switch (period) {
    case 'peak':
      return '峰时';
    case 'valley':
      return '谷时';
    default:
      return '平时';
  }
}

export function getPricePeriodColor(period: string): string {
  switch (period) {
    case 'peak':
      return 'text-red-400';
    case 'valley':
      return 'text-green-400';
    default:
      return 'text-yellow-400';
  }
}
