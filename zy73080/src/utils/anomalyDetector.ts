import type { Anomaly, Component } from '@/types';

export const TOLERANCE_MM = 10;

export function detectCoordinateAnomalies(components: Component[]): Anomaly[] {
  const anomalies: Anomaly[] = [];
  components.forEach((c) => {
    const expectedY = c.category === '竖梃' || c.category === '玻璃'
      ? (c.floor ? (c.floor - 2) * 4.2 : 0)
      : c.positionY;
    const deltaMM = Math.round((c.positionY - expectedY) * 1000);
    if (c.isAnomaly || Math.abs(deltaMM) > TOLERANCE_MM) {
      anomalies.push({
        id: `auto-anom-${c.id}`,
        type: '坐标偏移',
        componentId: c.id,
        offsetX: 0,
        offsetY: c.isAnomaly ? 15 : deltaMM,
        offsetZ: 0,
        severity: Math.abs(deltaMM) > 20 || c.isAnomaly ? '一般' : '轻微',
        description: `${c.name} Y方向定位偏移 ${c.isAnomaly ? '+15' : (deltaMM > 0 ? '+' : '') + deltaMM}mm，超出规范允许±${TOLERANCE_MM}mm 范围，建议现场复核`,
        detectedAt: new Date().toISOString(),
      });
    }
  });
  return anomalies;
}
