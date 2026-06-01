export const statusColors: Record<string, string> = {
  normal: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
  pending: '#8B5CF6',
};

export const statusLabels: Record<string, string> = {
  normal: '正常',
  warning: '警告',
  error: '异常',
  pending: '待确认',
};

export const sourceLabels: Record<string, string> = {
  system: '系统导入',
  photo: '照片补录',
  manual: '手动添加',
};

export const conflictTypeLabels: Record<string, string> = {
  coordinate: '坐标偏移',
  device_name: '设备名冲突',
  status: '状态冲突',
  missing_photo: '缺失照片',
};

export const formatTimestamp = (iso: string) => {
  const date = new Date(iso);
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const getStatusBgClass = (status: string) => {
  switch (status) {
    case 'normal': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
    case 'warning': return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
    case 'error': return 'bg-red-500/20 text-red-400 border-red-500/30';
    case 'pending': return 'bg-violet-500/20 text-violet-400 border-violet-500/30';
    default: return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
  }
};

export const getSourceBgClass = (source: string) => {
  switch (source) {
    case 'system': return 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30';
    case 'photo': return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
    case 'manual': return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
    default: return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
  }
};
