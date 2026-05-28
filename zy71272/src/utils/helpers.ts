import { Vector3, Musician } from '../types';
import { DB_COLORS } from './constants';

export const generateId = (): string => {
  return Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
};

export const distance2D = (a: Vector3, b: Vector3): number => {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dz * dz);
};

export const distance3D = (a: Vector3, b: Vector3): number => {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
};

export const clamp = (value: number, min: number, max: number): number => {
  return Math.max(min, Math.min(max, value));
};

export const lerp = (a: number, b: number, t: number): number => {
  return a + (b - a) * t;
};

export const dbToColor = (db: number): [number, number, number] => {
  if (db <= DB_COLORS[0].level) return DB_COLORS[0].color as [number, number, number];
  if (db >= DB_COLORS[DB_COLORS.length - 1].level) return DB_COLORS[DB_COLORS.length - 1].color as [number, number, number];

  for (let i = 0; i < DB_COLORS.length - 1; i++) {
    const lower = DB_COLORS[i];
    const upper = DB_COLORS[i + 1];
    if (db >= lower.level && db <= upper.level) {
      const t = (db - lower.level) / (upper.level - lower.level);
      return [
        lerp(lower.color[0], upper.color[0], t),
        lerp(lower.color[1], upper.color[1], t),
        lerp(lower.color[2], upper.color[2], t),
      ];
    }
  }
  return [255, 255, 255];
};

export const dbToColorHex = (db: number): string => {
  const [r, g, b] = dbToColor(db);
  return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
};

export const formatDate = (date: Date): string => {
  return new Date(date).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const roundTo = (value: number, decimals: number = 1): number => {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
};

export const getIssueTypeLabel = (type: string): string => {
  const labels: Record<string, string> = {
    source_overlap: '声源重叠',
    missing_monitor: '监听点问题',
    volume_imbalance: '音量比例失衡',
  };
  return labels[type] || type;
};

export const getIssueSeverityColor = (severity: string): string => {
  return severity === 'error' ? '#ff3366' : '#ff6b35';
};

export const calculateMonitorVolumeRatios = (
  musicians: Musician[],
  monitorPosition: Vector3
): { musician: Musician; level: number; ratio: number }[] => {
  const results = musicians.map(m => {
    const dist = distance2D(m.position, monitorPosition);
    const attenuation = dist > 0.1 ? 20 * Math.log10(dist / 1.0) : 0;
    const level = m.sourceLevel - attenuation;
    const linearPressure = Math.pow(10, level / 20);
    return { musician: m, level, linearPressure };
  });

  const totalPressure = results.reduce((sum, r) => sum + r.linearPressure, 0);

  return results.map(r => ({
    musician: r.musician,
    level: r.level,
    ratio: totalPressure > 0 ? r.linearPressure / totalPressure : 0,
  }));
};
