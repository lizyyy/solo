import type { SafetyThreshold, TemperatureRecord, ImportResult } from '@/types';

export const generateId = (): string => {
  return Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
};

export const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const formatDateShort = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const dedupeThresholds = (
  incoming: SafetyThreshold[],
  existing: SafetyThreshold[]
): ImportResult => {
  const newItems: SafetyThreshold[] = [];
  const updatedItems: SafetyThreshold[] = [];
  let skippedCount = 0;
  let duplicateCount = 0;

  const existingMap = new Map(
    existing.map(item => [`${item.thresholdCode}-${item.version}`, item])
  );

  incoming.forEach(item => {
    const key = `${item.thresholdCode}-${item.version}`;
    const existingItem = existingMap.get(key);

    if (!existingItem) {
      newItems.push({ ...item, id: generateId(), createdAt: new Date().toISOString() });
    } else {
      const isIdentical =
        existingItem.minTemp === item.minTemp &&
        existingItem.maxTemp === item.maxTemp &&
        existingItem.warningTemp === item.warningTemp &&
        existingItem.description === item.description;

      if (isIdentical) {
        skippedCount++;
        duplicateCount++;
      } else {
        updatedItems.push({
          ...item,
          id: existingItem.id,
          version: incrementVersion(existingItem.version),
          createdAt: existingItem.createdAt,
        });
      }
    }
  });

  return { newItems, updatedItems, skippedCount, duplicateCount };
};

export const incrementVersion = (version: string): string => {
  const match = version.match(/v(\d+)\.(\d+)/);
  if (match) {
    const major = parseInt(match[1], 10);
    const minor = parseInt(match[2], 10) + 1;
    return `v${major}.${minor}`;
  }
  return version + '-1';
};

export const determineRecordStatus = (
  record: TemperatureRecord,
  threshold: SafetyThreshold | undefined
): TemperatureRecord['status'] => {
  if (record.manualCoefficient !== undefined && !record.reviewReason) {
    return 'pending_review';
  }

  if (!threshold) {
    return 'warning';
  }

  const adjustedTemp = record.manualCoefficient
    ? record.temperature * record.manualCoefficient
    : record.temperature;

  if (adjustedTemp > threshold.maxTemp || adjustedTemp < threshold.minTemp) {
    return 'error';
  }

  if (adjustedTemp > threshold.warningTemp) {
    return 'warning';
  }

  return 'normal';
};

export const getStatusLabel = (status: string): string => {
  const labels: Record<string, string> = {
    normal: '正常',
    warning: '预警',
    error: '异常',
    pending_review: '待复核',
  };
  return labels[status] || status;
};

export const getStatusColor = (status: string): string => {
  const colors: Record<string, string> = {
    normal: 'bg-industry-success/10 text-industry-success border-industry-success/30',
    warning: 'bg-industry-warning/10 text-industry-warning border-industry-warning/30',
    error: 'bg-industry-danger/10 text-industry-danger border-industry-danger/30',
    pending_review: 'bg-amber-500/10 text-amber-600 border-amber-500/30',
  };
  return colors[status] || 'bg-gray-500/10 text-gray-600 border-gray-500/30';
};

export const getTemperatureColor = (temp: number, threshold?: SafetyThreshold): string => {
  if (!threshold) return '#64748b';
  
  if (temp > threshold.maxTemp || temp < threshold.minTemp) return '#ef4444';
  if (temp > threshold.warningTemp) return '#f59e0b';
  return '#10b981';
};

export const getRoleLabel = (role: string): string => {
  const labels: Record<string, string> = {
    trainer: '训练教练',
    engineer: '设备工程师',
    admin: '系统管理员',
  };
  return labels[role] || role;
};

export const getResponsiblePerson = (status: string, hasReviewReason: boolean): string => {
  if (status === 'pending_review' && !hasReviewReason) {
    return '设备工程师';
  }
  return '训练教练老唐';
};
