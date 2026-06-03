export const formatDateTime = (isoString: string): string => {
  const date = new Date(isoString);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};

export const formatDate = (isoString: string): string => {
  const date = new Date(isoString);
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
};

export const formatTime = (isoString: string): string => {
  const date = new Date(isoString);
  return date.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};

export const formatDistance = (value: number, unit: string): string => {
  return `${value} ${unit}`;
};

export const getUnitLabel = (unit: string): string => {
  const labels: Record<string, string> = {
    m: '米',
    ft: '英尺',
    km: '公里',
  };
  return labels[unit] || unit;
};

export const getCaliberLabel = (caliber: string): string => {
  const labels: Record<string, string> = {
    'metric-v2': '公制 V2（当前标准）',
    'imperial-v1': '英制 V1（旧口径）',
  };
  return labels[caliber] || caliber;
};
