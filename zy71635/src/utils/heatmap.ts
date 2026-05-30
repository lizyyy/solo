export function coverageToColor(coverage: number): string {
  if (coverage >= 85) return '#22c55e';
  if (coverage >= 70) return '#84cc16';
  if (coverage >= 55) return '#eab308';
  if (coverage >= 40) return '#f97316';
  if (coverage >= 20) return '#ef4444';
  return '#991b1b';
}

export function coverageToThreeColor(coverage: number): [number, number, number] {
  const hex = coverageToColor(coverage);
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return [r, g, b];
}

export function splToColor(spl: number): string {
  if (spl >= 85) return '#22c55e';
  if (spl >= 75) return '#84cc16';
  if (spl >= 65) return '#eab308';
  if (spl >= 55) return '#f97316';
  if (spl >= 45) return '#ef4444';
  return '#991b1b';
}

export function impactLevelColor(level: 'none' | 'low' | 'medium' | 'high'): string {
  switch (level) {
    case 'none': return '#6b7280';
    case 'low': return '#22c55e';
    case 'medium': return '#f97316';
    case 'high': return '#ef4444';
  }
}

export function impactLevelLabel(level: 'none' | 'low' | 'medium' | 'high'): string {
  switch (level) {
    case 'none': return '无影响';
    case 'low': return '低';
    case 'medium': return '中';
    case 'high': return '高';
  }
}
