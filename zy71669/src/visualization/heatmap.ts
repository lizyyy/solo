import { SimulationResult, HeatmapConfig, KitchenLayout } from '../types';
import { normalizeToMeters } from '../utils/units';

const COLOR_SCHEMES: Record<string, Array<{ r: number; g: number; b: number }>> = {
  viridis: [
    { r: 68, g: 1, b: 84 },
    { r: 72, g: 40, b: 120 },
    { r: 62, g: 74, b: 137 },
    { r: 49, g: 104, b: 142 },
    { r: 38, g: 130, b: 142 },
    { r: 31, g: 158, b: 137 },
    { r: 53, g: 183, b: 121 },
    { r: 109, g: 205, b: 89 },
    { r: 180, g: 222, b: 44 },
    { r: 253, g: 231, b: 37 },
  ],
  plasma: [
    { r: 13, g: 8, b: 135 },
    { r: 75, g: 3, b: 161 },
    { r: 125, g: 3, b: 168 },
    { r: 168, g: 34, b: 150 },
    { r: 203, g: 70, b: 121 },
    { r: 229, g: 107, b: 93 },
    { r: 248, g: 148, b: 65 },
    { r: 253, g: 191, b: 40 },
    { r: 240, g: 236, b: 34 },
    { r: 240, g: 249, b: 33 },
  ],
  rainbow: [
    { r: 0, g: 0, b: 255 },
    { r: 0, g: 128, b: 255 },
    { r: 0, g: 255, b: 255 },
    { r: 0, g: 255, b: 128 },
    { r: 0, g: 255, b: 0 },
    { r: 128, g: 255, b: 0 },
    { r: 255, g: 255, b: 0 },
    { r: 255, g: 128, b: 0 },
    { r: 255, g: 0, b: 0 },
    { r: 128, g: 0, b: 0 },
  ],
  'red-blue': [
    { r: 0, g: 0, b: 255 },
    { r: 64, g: 64, b: 255 },
    { r: 128, g: 128, b: 255 },
    { r: 192, g: 192, b: 255 },
    { r: 255, g: 255, b: 255 },
    { r: 255, g: 192, b: 192 },
    { r: 255, g: 128, b: 128 },
    { r: 255, g: 64, b: 64 },
    { r: 255, g: 0, b: 0 },
    { r: 192, g: 0, b: 0 },
  ],
};

function interpolateColor(
  value: number,
  min: number,
  max: number,
  scheme: string,
): { r: number; g: number; b: number } {
  const colors = COLOR_SCHEMES[scheme] || COLOR_SCHEMES.viridis;
  
  if (max === min) {
    return colors[Math.floor(colors.length / 2)];
  }
  
  const normalized = Math.max(0, Math.min(1, (value - min) / (max - min)));
  const position = normalized * (colors.length - 1);
  const index = Math.floor(position);
  const fraction = position - index;
  
  const c1 = colors[Math.min(index, colors.length - 1)];
  const c2 = colors[Math.min(index + 1, colors.length - 1)];
  
  return {
    r: Math.round(c1.r + (c2.r - c1.r) * fraction),
    g: Math.round(c1.g + (c2.g - c1.g) * fraction),
    b: Math.round(c1.b + (c2.b - c1.b) * fraction),
  };
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
}

export function generateHeatmapSVG(
  result: SimulationResult,
  layout: KitchenLayout,
  config: HeatmapConfig = {
    colorScheme: 'viridis',
    showLegend: true,
    showGrid: false,
  },
): string {
  const { gridSize, gridResolution, cells } = result;
  const cellSize = 20;
  const width = gridSize.width * cellSize;
  const height = gridSize.height * cellSize;
  const padding = 40;
  
  const concentrations = cells.map(c => c.concentration);
  const minValue = config.minValue ?? Math.min(...concentrations);
  const maxValue = config.maxValue ?? Math.max(...concentrations);
  
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width + padding * 2}" height="${height + padding * 2 + (config.showLegend ? 60 : 0)}">`;
  svg += `<style>
    .label { font-family: Arial, sans-serif; font-size: 12px; fill: #333; }
    .title { font-family: Arial, sans-serif; font-size: 16px; font-weight: bold; fill: #333; }
    .stove-label { font-family: Arial, sans-serif; font-size: 10px; fill: #fff; text-anchor: middle; }
    .exhaust-label { font-family: Arial, sans-serif; font-size: 10px; fill: #fff; text-anchor: middle; }
    .detection-label { font-family: Arial, sans-serif; font-size: 9px; fill: #000; text-anchor: middle; }
  </style>`;
  
  svg += `<text x="${width / 2 + padding}" y="25" class="title">${result.layoutName} - 油烟浓度热力图</text>`;
  
  svg += `<g transform="translate(${padding}, ${padding + 10})">`;
  
  for (let y = 0; y < gridSize.height; y++) {
    for (let x = 0; x < gridSize.width; x++) {
      const cell = cells[y * gridSize.width + x];
      const color = interpolateColor(cell.concentration, minValue, maxValue, config.colorScheme);
      const hexColor = rgbToHex(color.r, color.g, color.b);
      
      svg += `<rect x="${x * cellSize}" y="${y * cellSize}" width="${cellSize}" height="${cellSize}" 
              fill="${hexColor}" stroke="${config.showGrid ? '#ccc' : 'none'}" stroke-width="0.5"/>`;
    }
  }
  
  svg += renderKitchenElements(layout, cellSize, gridResolution);
  
  svg += `</g>`;
  
  if (config.showLegend) {
    svg += renderLegend(padding, height + padding + 20, width, minValue, maxValue, config.colorScheme);
  }
  
  svg += `</svg>`;
  
  return svg;
}

function renderKitchenElements(layout: KitchenLayout, cellSize: number, gridResolution: number): string {
  let elements = '';
  
  for (const stove of layout.stoves) {
    if (!stove.enabled) continue;
    
    const x = normalizeToMeters(stove.position.x, stove.position.unit) / gridResolution * cellSize;
    const y = normalizeToMeters(stove.position.y, stove.position.unit) / gridResolution * cellSize;
    const w = normalizeToMeters(stove.dimensions.width, stove.dimensions.unit) / gridResolution * cellSize;
    const h = normalizeToMeters(stove.dimensions.height, stove.dimensions.unit) / gridResolution * cellSize;
    
    elements += `<rect x="${x}" y="${y}" width="${w}" height="${h}" 
                  fill="#ff6b35" stroke="#d63031" stroke-width="2" rx="3"/>`;
    elements += `<text x="${x + w / 2}" y="${y + h / 2 + 4}" class="stove-label">${stove.name}</text>`;
  }
  
  for (const vent of layout.exhaustVents) {
    if (!vent.enabled) continue;
    
    const x = normalizeToMeters(vent.position.x, vent.position.unit) / gridResolution * cellSize;
    const y = normalizeToMeters(vent.position.y, vent.position.unit) / gridResolution * cellSize;
    const w = normalizeToMeters(vent.dimensions.width, vent.dimensions.unit) / gridResolution * cellSize;
    const h = normalizeToMeters(vent.dimensions.height, vent.dimensions.unit) / gridResolution * cellSize;
    
    elements += `<rect x="${x}" y="${y}" width="${w}" height="${h}" 
                  fill="#0984e3" stroke="#0652DD" stroke-width="2" rx="3"/>`;
    elements += `<text x="${x + w / 2}" y="${y + h / 2 + 4}" class="exhaust-label">${vent.name}</text>`;
  }
  
  for (const point of layout.detectionPoints) {
    const x = normalizeToMeters(point.position.x, point.position.unit) / gridResolution * cellSize;
    const y = normalizeToMeters(point.position.y, point.position.unit) / gridResolution * cellSize;
    
    elements += `<circle cx="${x}" cy="${y}" r="6" fill="#fdcb6e" stroke="#e17055" stroke-width="2"/>`;
    elements += `<circle cx="${x}" cy="${y}" r="2" fill="#d63031"/>`;
    elements += `<text x="${x}" y="${y - 10}" class="detection-label">${point.name}</text>`;
  }
  
  for (const obstacle of layout.obstacles) {
    const x = normalizeToMeters(obstacle.position.x, obstacle.position.unit) / gridResolution * cellSize;
    const y = normalizeToMeters(obstacle.position.y, obstacle.position.unit) / gridResolution * cellSize;
    const w = normalizeToMeters(obstacle.dimensions.width, obstacle.dimensions.unit) / gridResolution * cellSize;
    const h = normalizeToMeters(obstacle.dimensions.height, obstacle.dimensions.unit) / gridResolution * cellSize;
    
    elements += `<rect x="${x}" y="${y}" width="${w}" height="${h}" 
                  fill="rgba(99, 110, 114, ${0.3 + obstacle.permeability * 0.4})" 
                  stroke="#636e72" stroke-width="1" stroke-dasharray="${obstacle.permeability > 0.5 ? '4,2' : 'none'}"/>`;
  }
  
  return elements;
}

function renderLegend(x: number, y: number, width: number, minValue: number, maxValue: number, colorScheme: string): string {
  const barWidth = width;
  const barHeight = 20;
  const steps = 50;
  
  let legend = `<g transform="translate(${x}, ${y})">`;
  legend += `<text x="0" y="-5" class="label">油烟浓度 (mg/m³)</text>`;
  
  for (let i = 0; i < steps; i++) {
    const value = minValue + (maxValue - minValue) * (i / steps);
    const color = interpolateColor(value, minValue, maxValue, colorScheme);
    const hexColor = rgbToHex(color.r, color.g, color.b);
    
    legend += `<rect x="${(i / steps) * barWidth}" y="0" 
                  width="${barWidth / steps + 1}" height="${barHeight}" 
                  fill="${hexColor}"/>`;
  }
  
  legend += `<rect x="0" y="0" width="${barWidth}" height="${barHeight}" fill="none" stroke="#333" stroke-width="1"/>`;
  
  const labelCount = 5;
  for (let i = 0; i <= labelCount; i++) {
    const value = minValue + (maxValue - minValue) * (i / labelCount);
    const posX = (i / labelCount) * barWidth;
    legend += `<text x="${posX}" y="${barHeight + 15}" class="label" text-anchor="middle">${value.toFixed(2)}</text>`;
  }
  
  legend += `</g>`;
  
  return legend;
}
