export const RISK_GRADIENT = [
  { level: 1, color: '#22C55E', label: '极低' },
  { level: 2, color: '#4ADE80', label: '很低' },
  { level: 3, color: '#86EFAC', label: '低' },
  { level: 4, color: '#EAB308', label: '中低' },
  { level: 5, color: '#FACC15', label: '中' },
  { level: 6, color: '#F97316', label: '中高' },
  { level: 7, color: '#FB923C', label: '高' },
  { level: 8, color: '#EF4444', label: '很高' },
  { level: 9, color: '#DC2626', label: '极高' },
  { level: 10, color: '#991B1B', label: '危险' },
];

export function getRiskColor(riskLevel: number): string {
  const clampedLevel = Math.max(1, Math.min(10, Math.round(riskLevel)));
  const entry = RISK_GRADIENT.find((g) => g.level === clampedLevel);
  return entry?.color || '#6B7280';
}

export function getRiskLabel(riskLevel: number): string {
  const clampedLevel = Math.max(1, Math.min(10, Math.round(riskLevel)));
  const entry = RISK_GRADIENT.find((g) => g.level === clampedLevel);
  return entry?.label || '未知';
}

export function interpolateColor(color1: string, color2: string, factor: number): string {
  const hex = (x: string) => parseInt(x, 16);
  const r1 = hex(color1.slice(1, 3));
  const g1 = hex(color1.slice(3, 5));
  const b1 = hex(color1.slice(5, 7));
  const r2 = hex(color2.slice(1, 3));
  const g2 = hex(color2.slice(3, 5));
  const b2 = hex(color2.slice(5, 7));

  const r = Math.round(r1 + (r2 - r1) * factor);
  const g = Math.round(g1 + (g2 - g1) * factor);
  const b = Math.round(b1 + (b2 - b1) * factor);

  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

export function getPrincipalColor(principal: number, maxPrincipal: number): string {
  const ratio = Math.min(1, principal / maxPrincipal);
  if (ratio < 0.25) return '#3B82F6';
  if (ratio < 0.5) return '#60A5FA';
  if (ratio < 0.75) return '#93C5FD';
  return '#BFDBFE';
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16) / 255,
        g: parseInt(result[2], 16) / 255,
        b: parseInt(result[3], 16) / 255,
      }
    : { r: 0.5, g: 0.5, b: 0.5 };
}

export function hexToRgba(hex: string, alpha: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, ${alpha})`;
}

export const ANOMALY_COLORS: Record<string, string> = {
  maturity_mismatch: '#F59E0B',
  guarantee_repeat: '#EF4444',
  rating_override: '#8B5CF6',
};

export const VIEW_COLORS = {
  background: '#0F172A',
  surface: '#1E293B',
  border: '#334155',
  text: '#F1F5F9',
  textSecondary: '#94A3B8',
  accent: '#06B6D4',
  accentHover: '#22D3EE',
};
