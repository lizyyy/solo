import { format } from 'date-fns';

export const formatNumber = (num: number | null, decimals: number = 2): string => {
  if (num === null) return '-';
  if (Math.abs(num) >= 1e6 || (Math.abs(num) < 0.01 && num !== 0)) {
    return num.toExponential(decimals);
  }
  return num.toFixed(decimals);
};

export const formatDateTime = (isoString: string): string => {
  try {
    return format(new Date(isoString), 'yyyy-MM-dd HH:mm:ss');
  } catch {
    return isoString;
  }
};

export const formatDate = (isoString: string): string => {
  try {
    return format(new Date(isoString), 'yyyy-MM-dd');
  } catch {
    return isoString;
  }
};

export const formatProcessType = (type: string): string => {
  const map: Record<string, string> = {
    'unit_conversion': '单位换算',
    'null_fill': '空值处理',
    'duplicate_merge': '重复合并',
    'anomaly_mark': '异常标记',
  };
  return map[type] || type;
};

export const formatStatus = (status: string): string => {
  const map: Record<string, string> = {
    'normal': '正常',
    'pending': '待确认',
    'confirmed': '已确认',
    'historical': '历史数据',
  };
  return map[status] || status;
};

export const formatIssueType = (type: string): string => {
  const map: Record<string, string> = {
    'null': '空值',
    'duplicate': '重复数据',
    'unit_mismatch': '单位混用',
    'anomaly': '异常值',
  };
  return map[type] || type;
};

export const getStatusColor = (status: string): string => {
  const map: Record<string, string> = {
    'normal': '#43a047',
    'pending': '#ff7043',
    'confirmed': '#1e88e5',
    'historical': '#8e24aa',
  };
  return map[status] || '#757575';
};

export const getIssueTypeColor = (type: string): string => {
  const map: Record<string, string> = {
    'null': '#f57c00',
    'duplicate': '#7b1fa2',
    'unit_mismatch': '#1976d2',
    'anomaly': '#d32f2f',
  };
  return map[type] || '#757575';
};

export const formatScientific = (num: number): string => {
  return num.toExponential(2).replace('e+0', 'e').replace('e+', 'e');
};
