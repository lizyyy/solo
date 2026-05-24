import type { PathPoint, HeatmapCell, PickingOrder, Aisle } from '../data/types';

export function calculateHeatmap(
  orders: PickingOrder[],
  aisles: Aisle[],
  timeRange: { start: number; end: number },
  gridSize: number = 1,
  intensity: number = 1
): HeatmapCell[] {
  const heatmap: Map<string, HeatmapCell> = new Map();
  const baseWeight = 10 * intensity;

  for (const order of orders) {
    const filteredPath = order.path.filter(
      (p) => p.timestamp >= timeRange.start && p.timestamp <= timeRange.end
    );

    for (let i = 0; i < filteredPath.length; i++) {
      const point = filteredPath[i];
      const prevPoint = i > 0 ? filteredPath[i - 1] : null;

      const aisleWidthFactor = getAisleWidthFactor(point.x, point.z, aisles);
      const dwellTimeFactor = prevPoint ? calculateDwellTimeFactor(point, prevPoint) : 0;

      const cellX = Math.floor(point.x / gridSize);
      const cellZ = Math.floor(point.z / gridSize);
      const key = `${cellX},${cellZ}`;

      const value = baseWeight * (1 + dwellTimeFactor) * aisleWidthFactor;

      const existing = heatmap.get(key);
      if (existing) {
        existing.value += value;
        existing.count += 1;
      } else {
        heatmap.set(key, {
          x: cellX * gridSize + gridSize / 2,
          z: cellZ * gridSize + gridSize / 2,
          value,
          count: 1,
        });
      }
    }
  }

  return Array.from(heatmap.values());
}

function getAisleWidthFactor(x: number, z: number, aisles: Aisle[]): number {
  for (const aisle of aisles) {
    if (isPointInAisle(x, z, aisle)) {
      return aisle.isNarrow ? 2.0 : 1.0;
    }
  }
  return 1.0;
}

function isPointInAisle(x: number, z: number, aisle: Aisle): boolean {
  const halfWidth = aisle.width / 2 + 1;
  if (aisle.orientation === 'z') {
    return (
      x >= aisle.x1 - halfWidth &&
      x <= aisle.x1 + halfWidth &&
      z >= Math.min(aisle.z1, aisle.z2) &&
      z <= Math.max(aisle.z1, aisle.z2)
    );
  } else {
    return (
      z >= aisle.z1 - halfWidth &&
      z <= aisle.z1 + halfWidth &&
      x >= Math.min(aisle.x1, aisle.x2) &&
      x <= Math.max(aisle.x1, aisle.x2)
    );
  }
}

function calculateDwellTimeFactor(point: PathPoint, prevPoint: PathPoint): number {
  const timeDiff = point.timestamp - prevPoint.timestamp;
  const distance = Math.sqrt(
    Math.pow(point.x - prevPoint.x, 2) + Math.pow(point.z - prevPoint.z, 2)
  );
  const speed = distance / (timeDiff / 1000);

  if (speed < 0.3) {
    return Math.min(2, timeDiff / 5000);
  }
  return 0;
}

export function heatValueToColor(value: number, maxValue: number): string {
  const normalized = Math.min(value / maxValue, 1);

  if (normalized < 0.25) {
    const t = normalized / 0.25;
    return interpolateColor('#1E40AF', '#0891B2', t);
  } else if (normalized < 0.5) {
    const t = (normalized - 0.25) / 0.25;
    return interpolateColor('#0891B2', '#059669', t);
  } else if (normalized < 0.75) {
    const t = (normalized - 0.5) / 0.25;
    return interpolateColor('#059669', '#D97706', t);
  } else {
    const t = (normalized - 0.75) / 0.25;
    return interpolateColor('#D97706', '#DC2626', t);
  }
}

function interpolateColor(color1: string, color2: string, t: number): string {
  const r1 = parseInt(color1.slice(1, 3), 16);
  const g1 = parseInt(color1.slice(3, 5), 16);
  const b1 = parseInt(color1.slice(5, 7), 16);

  const r2 = parseInt(color2.slice(1, 3), 16);
  const g2 = parseInt(color2.slice(3, 5), 16);
  const b2 = parseInt(color2.slice(5, 7), 16);

  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const b = Math.round(b1 + (b2 - b1) * t);

  return `rgb(${r}, ${g}, ${b})`;
}

export function getHeatmapColorStops(): { color: string; position: number }[] {
  return [
    { color: '#1E40AF', position: 0 },
    { color: '#0891B2', position: 0.25 },
    { color: '#059669', position: 0.5 },
    { color: '#D97706', position: 0.75 },
    { color: '#DC2626', position: 1 },
  ];
}
