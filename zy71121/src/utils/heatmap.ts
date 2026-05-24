import { PlantParams, LightParams } from '../types';

export function calculateHeatmap(
  plants: PlantParams,
  light: LightParams,
  resolution: number = 50
): number[][] {
  const width = plants.rowsCount * plants.rowSpacing / 100;
  const length = plants.plantsPerRow * plants.plantSpacing / 100;
  
  const heatmap: number[][] = [];
  const sunAngleRad = (light.sunAngle * Math.PI) / 180;
  const shadowLength = Math.tan(sunAngleRad);
  
  for (let i = 0; i < resolution; i++) {
    const row: number[] = [];
    for (let j = 0; j < resolution; j++) {
      const x = (i / resolution - 0.5) * width;
      const z = (j / resolution - 0.5) * length;
      
      let lightValue = Math.cos(sunAngleRad) * light.sunIntensity;
      
      for (let r = 0; r < plants.rowsCount; r++) {
        for (let p = 0; p < plants.plantsPerRow; p++) {
          const plantX = (r - (plants.rowsCount - 1) / 2) * plants.rowSpacing / 100;
          const plantZ = (p - (plants.plantsPerRow - 1) / 2) * plants.plantSpacing / 100;
          
          const dx = x - plantX;
          const dz = z - plantZ;
          const distance = Math.sqrt(dx * dx + dz * dz);
          const canopyRadius = plants.canopyDiameter / 200;
          
          if (distance < canopyRadius * 1.5) {
            const shadowFactor = 1 - Math.min(1, distance / (canopyRadius * 1.5));
            lightValue *= (1 - shadowFactor * 0.7);
          }
        }
      }
      
      row.push(Math.max(0, Math.min(1, lightValue)));
    }
    heatmap.push(row);
  }
  
  return heatmap;
}

export function getHeatmapStats(heatmap: number[][]) {
  const flat = heatmap.flat();
  return {
    avg: flat.reduce((a, b) => a + b, 0) / flat.length,
    min: Math.min(...flat),
    max: Math.max(...flat),
  };
}

export function getHeatmapColor(value: number): string {
  const colors = [
    { pos: 0, r: 180, g: 50, b: 50 },
    { pos: 0.3, r: 255, g: 140, b: 50 },
    { pos: 0.6, r: 255, g: 230, b: 80 },
    { pos: 1, r: 80, g: 200, b: 120 },
  ];
  
  for (let i = 0; i < colors.length - 1; i++) {
    if (value <= colors[i + 1].pos) {
      const t = (value - colors[i].pos) / (colors[i + 1].pos - colors[i].pos);
      const r = Math.round(colors[i].r + t * (colors[i + 1].r - colors[i].r));
      const g = Math.round(colors[i].g + t * (colors[i + 1].g - colors[i].g));
      const b = Math.round(colors[i].b + t * (colors[i + 1].b - colors[i].b));
      return `rgb(${r}, ${g}, ${b})`;
    }
  }
  
  return `rgb(${colors[colors.length - 1].r}, ${colors[colors.length - 1].g}, ${colors[colors.length - 1].b})`;
}
