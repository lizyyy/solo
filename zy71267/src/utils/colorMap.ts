import * as THREE from 'three';
import type { DisplayParameter } from '../data/models/acoustic';

export interface ColorMapRange {
  min: number;
  max: number;
}

export const PARAMETER_RANGES: Record<DisplayParameter, ColorMapRange> = {
  reverberationTime: { min: 1.0, max: 2.5 },
  soundPressureLevel: { min: 70, max: 95 },
  clarity: { min: 0, max: 8 },
};

export function viridisColor(t: number): THREE.Color {
  t = Math.max(0, Math.min(1, t));
  
  const r = Math.round(255 * (0.2777 + t * (0.1050 + t * (-0.3309 + t * (-4.6343 + t * (6.1824 - t * 2.5115))))));
  const g = Math.round(255 * (0.0054 + t * (1.4076 + t * (0.3408 + t * (-1.0632 + t * (-0.3678 + t * 0.3809))))));
  const b = Math.round(255 * (0.3340 + t * (1.3814 + t * (0.0884 + t * (-0.4625 + t * (1.0967 - t * 0.7836))))));
  
  return new THREE.Color(r / 255, g / 255, b / 255);
}

export function heatmapColor(t: number): THREE.Color {
  t = Math.max(0, Math.min(1, t));
  
  if (t < 0.25) {
    const nt = t / 0.25;
    return new THREE.Color(0, nt * 0.5, 0.5 + nt * 0.5);
  } else if (t < 0.5) {
    const nt = (t - 0.25) / 0.25;
    return new THREE.Color(0, 0.5 + nt * 0.5, 1 - nt * 0.5);
  } else if (t < 0.75) {
    const nt = (t - 0.5) / 0.25;
    return new THREE.Color(nt, 1, 0.5 - nt * 0.5);
  } else {
    const nt = (t - 0.75) / 0.25;
    return new THREE.Color(1, 1 - nt * 0.5, 0);
  }
}

export function getParameterColor(
  value: number,
  param: DisplayParameter,
  useHeatmap = false
): THREE.Color {
  const range = PARAMETER_RANGES[param];
  const t = (value - range.min) / (range.max - range.min);
  return useHeatmap ? heatmapColor(t) : viridisColor(t);
}

export function getRayColorByOrder(order: number, maxOrder = 5): [number, number, number] {
  const t = Math.min(order / maxOrder, 1);
  const color = heatmapColor(1 - t);
  return [color.r, color.g, color.b];
}

export function getHexColorString(color: THREE.Color): string {
  return '#' + color.getHexString();
}

export function createColorLegend(param: DisplayParameter, steps = 5) {
  const range = PARAMETER_RANGES[param];
  const legend = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const value = range.min + t * (range.max - range.min);
    legend.push({
      value,
      color: getHexColorString(getParameterColor(value, param)),
    });
  }
  return legend;
}
