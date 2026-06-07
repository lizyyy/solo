import type { ThresholdItem, PlaybackRecord, ImportResult, VersionHistory } from '../types';

export const generateId = (): string => {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};

export const formatDateTime = (date: Date): string => {
  return date.toISOString().slice(0, 19).replace('T', ' ');
};

export const checkThresholdConsistency = (thresholdValue: number, reportValue: number): boolean => {
  return Math.abs(thresholdValue - reportValue) < 0.0001;
};

export const detectAnomalies = (thresholds: ThresholdItem[]): ThresholdItem[] => {
  return thresholds.map(t => ({
    ...t,
    isConsistent: checkThresholdConsistency(t.thresholdValue, t.reportValue)
  }));
};

export const hasAnyAnomaly = (thresholds: ThresholdItem[]): boolean => {
  return thresholds.some(t => !t.isConsistent);
};

export const findDuplicateByNoteId = (
  records: PlaybackRecord[],
  noteId: string
): PlaybackRecord | undefined => {
  return records.find(r => r.noteId === noteId);
};

export const createVersionHistory = (
  playbackId: string,
  fieldName: string,
  oldValue: string,
  newValue: string,
  modifiedBy: string,
  changeType: 'create' | 'update' | 'rollback' = 'update',
  version: number = 1
): VersionHistory => {
  return {
    id: generateId(),
    playbackId,
    version,
    fieldName,
    oldValue,
    newValue,
    modifiedBy,
    modifiedAt: formatDateTime(new Date()),
    changeType
  };
};

export const getHumanFriendlyError = (errorCode: string, context?: Record<string, string>): string => {
  const errorMessages: Record<string, string> = {
    'file_empty': '请选择要导入的文件，文件不能为空',
    'file_invalid': '文件格式不正确，请上传有效的阈值调参笔记文件',
    'file_too_large': '文件太大了，请上传小于10MB的文件',
    'threshold_missing': '请填写阈值数值，不能为空',
    'report_value_missing': '请填写报告中的数值，不能为空',
    'metric_name_missing': '请填写指标名称，不能为空',
    'note_id_duplicate': '该调参笔记已存在，系统将自动合并更新，不会重复计数',
    'bucket_url_invalid': '请输入有效的线上实验桶链接',
    'review_required': '存在阈值与报告不一致的记录，请先提交数据科学家复核',
    'permission_denied': '您没有权限执行此操作，请联系管理员',
    'network_error': '网络连接失败，请检查网络后重试',
    'unknown_error': '操作失败，请稍后重试'
  };

  let message = errorMessages[errorCode] || errorMessages['unknown_error'];
  
  if (context) {
    Object.keys(context).forEach(key => {
      message = message.replace(`{${key}}`, context[key]);
    });
  }
  
  return message;
};

export const getStatusLabel = (status: string): string => {
  const labels: Record<string, string> = {
    'normal': '正常',
    'pending_review': '待复核',
    'modified': '已修改'
  };
  return labels[status] || status;
};

export const getStatusColor = (status: string): string => {
  const colors: Record<string, string> = {
    'normal': 'bg-green-500',
    'pending_review': 'bg-orange-500',
    'modified': 'bg-blue-500'
  };
  return colors[status] || 'bg-gray-500';
};

export const getStepLabel = (step: string): string => {
  const labels: Record<string, string> = {
    'import': '导入调参笔记',
    'bucket': '补看线上实验桶',
    'metric': '分层指标更新'
  };
  return labels[step] || step;
};

export const parseThresholdNote = (fileContent: string): {
  noteId: string;
  thresholds: ThresholdItem[];
  remark?: string;
} | null => {
  try {
    const data = JSON.parse(fileContent);
    const noteId = data.noteId || data.id || generateId();
    const thresholds = (data.thresholds || []).map((t: any) => ({
      metricName: t.metricName || t.name || '未命名指标',
      thresholdValue: Number(t.thresholdValue || t.threshold || 0),
      reportValue: Number(t.reportValue || t.report || 0),
      isConsistent: false
    }));
    
    return {
      noteId,
      thresholds: detectAnomalies(thresholds),
      remark: data.remark
    };
  } catch {
    return null;
  }
};

export const mergePlaybackRecord = (
  existing: PlaybackRecord,
  newData: Partial<PlaybackRecord>
): { record: PlaybackRecord; updatedFields: string[] } => {
  const updatedFields: string[] = [];
  const merged = { ...existing };

  if (newData.thresholds && JSON.stringify(newData.thresholds) !== JSON.stringify(existing.thresholds)) {
    merged.thresholds = newData.thresholds;
    merged.hasAnomaly = hasAnyAnomaly(newData.thresholds);
    updatedFields.push('thresholds');
  }

  if (newData.remark !== undefined && newData.remark !== existing.remark) {
    merged.remark = newData.remark;
    updatedFields.push('remark');
  }

  merged.updatedAt = formatDateTime(new Date());
  if (merged.hasAnomaly) {
    merged.status = 'pending_review';
  }

  return { record: merged, updatedFields };
};
