export const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};

export const formatNumber = (num: number, decimals: number = 4): string => {
  return num.toFixed(decimals);
};

export const formatCoordinate = (lat: number, lng: number): string => {
  const latDir = lat >= 0 ? 'N' : 'S';
  const lngDir = lng >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(4)}°${latDir}, ${Math.abs(lng).toFixed(4)}°${lngDir}`;
};

export const formatQuality = (quality: string): string => {
  const map: Record<string, string> = {
    excellent: '优秀',
    good: '良好',
    fair: '一般',
    poor: '较差',
  };
  return map[quality] || quality;
};

export const formatSource = (source: string): string => {
  const map: Record<string, string> = {
    sensor: '传感器',
    manual: '人工录入',
    legacy: '旧数据',
  };
  return map[source] || source;
};

export const cn = (...classes: (string | undefined | false | null)[]): string => {
  return classes.filter(Boolean).join(' ');
};
