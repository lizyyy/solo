import type { WindDataPoint, SafetyRadius, WindSpeed } from '../../shared/types';

export const directionToLabel = (deg: number): string => {
  const directions = ['北', '东北', '东', '东南', '南', '西南', '西', '西北'];
  const index = Math.round(deg / 45) % 8;
  return directions[index];
};

export const getWindRoseData = (
  radiusTable: SafetyRadius[],
  version: 'new' | 'legacy' | 'both' = 'both'
): WindDataPoint[] => {
  const directions = [0, 45, 90, 135, 180, 225, 270, 315];
  
  return directions.map(dir => {
    const newRadius = radiusTable.find(r => r.windDirection === dir && r.windSpeed === 'medium' && r.version === 'new')?.radius || 200;
    const legacyRadius = radiusTable.find(r => r.windDirection === dir && r.windSpeed === 'medium' && r.version === 'legacy')?.radius || 160;
    
    return {
      direction: dir,
      directionLabel: directionToLabel(dir),
      frequency: Math.random() * 30 + 10,
      safetyDistance: version === 'legacy' ? legacyRadius : newRadius,
      requiredDistance: version === 'new' ? newRadius : legacyRadius,
      newRadius,
      legacyRadius,
    } as WindDataPoint & { directionLabel: string; newRadius: number; legacyRadius: number };
  });
};

export const getRequiredRadius = (
  radiusTable: SafetyRadius[],
  windDirection: number,
  windSpeed: WindSpeed,
  version: 'new' | 'legacy' = 'new'
): number => {
  const normalizedDir = Math.round(windDirection / 45) * 45 % 360;
  const entry = radiusTable.find(r => 
    r.windDirection === normalizedDir && r.windSpeed === windSpeed && r.version === version
  );
  return entry?.radius || (version === 'new' ? 200 : 160);
};

export const formatDateTime = (isoString: string): string => {
  const date = new Date(isoString);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
};

export const formatNumber = (num: number): string => {
  if (num >= 10000) {
    return (num / 10000).toFixed(1) + '万';
  }
  return num.toLocaleString();
};

export const getStatusColor = (status: string): string => {
  switch (status) {
    case 'success': return 'bg-emerald-500';
    case 'pending_review': return 'bg-amber-500';
    case 'blocked': return 'bg-amber-500';
    case 'legacy': return 'bg-blue-500';
    case 'danger': return 'bg-red-500';
    default: return 'bg-gray-500';
  }
};

export const getStatusBgClass = (status: string): string => {
  switch (status) {
    case 'success': return 'status-success';
    case 'pending_review': 
    case 'blocked': return 'status-pending';
    case 'legacy': return 'status-legacy';
    case 'danger': return 'status-danger';
    default: return 'bg-gray-100 text-gray-600';
  }
};

export const getWindSpeedColor = (speed: WindSpeed): string => {
  switch (speed) {
    case 'low': return 'text-emerald-600';
    case 'medium': return 'text-amber-600';
    case 'high': return 'text-red-600';
    default: return 'text-gray-600';
  }
};

export const calculateCompliance = (actual: number, required: number): { compliant: boolean; margin: number } => {
  const margin = actual - required;
  return {
    compliant: margin >= 0,
    margin: Number(margin.toFixed(1))
  };
};
