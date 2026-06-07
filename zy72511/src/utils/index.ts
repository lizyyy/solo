import { SampleType, AttributionStatus, OperationType } from '../types';

export const getSampleTypeLabel = (type: SampleType): string => {
  const labels: Record<SampleType, string> = {
    [SampleType.NORMAL]: '顺利记录',
    [SampleType.VERSION_CONFLICT]: '版本冲突',
    [SampleType.GRAY_BACKFILL]: '灰度补录'
  };
  return labels[type];
};

export const getSampleTypeColor = (type: SampleType): string => {
  const colors: Record<SampleType, string> = {
    [SampleType.NORMAL]: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    [SampleType.VERSION_CONFLICT]: 'bg-amber-100 text-amber-700 border-amber-200',
    [SampleType.GRAY_BACKFILL]: 'bg-violet-100 text-violet-700 border-violet-200'
  };
  return colors[type];
};

export const getStatusLabel = (status: AttributionStatus): string => {
  const labels: Record<AttributionStatus, string> = {
    [AttributionStatus.PENDING]: '待处理',
    [AttributionStatus.NORMAL]: '正常归因',
    [AttributionStatus.CONFLICT]: '存在冲突',
    [AttributionStatus.PENDING_REVIEW]: '待运营复核',
    [AttributionStatus.CONFIRMED]: '已确认',
    [AttributionStatus.REJECTED]: '已驳回'
  };
  return labels[status];
};

export const getStatusColor = (status: AttributionStatus): string => {
  const colors: Record<AttributionStatus, string> = {
    [AttributionStatus.PENDING]: 'bg-gray-100 text-gray-700 border-gray-200',
    [AttributionStatus.NORMAL]: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    [AttributionStatus.CONFLICT]: 'bg-red-100 text-red-700 border-red-200',
    [AttributionStatus.PENDING_REVIEW]: 'bg-amber-100 text-amber-700 border-amber-200',
    [AttributionStatus.CONFIRMED]: 'bg-blue-100 text-blue-700 border-blue-200',
    [AttributionStatus.REJECTED]: 'bg-rose-100 text-rose-700 border-rose-200'
  };
  return colors[status];
};

export const getOperationTypeLabel = (type: OperationType): string => {
  const labels: Record<OperationType, string> = {
    [OperationType.IMPORT]: '导入脱敏规则',
    [OperationType.REVIEW]: '补看灰度批次',
    [OperationType.CONFIRM]: '确认归因',
    [OperationType.REJECT]: '驳回归因',
    [OperationType.UPDATE]: '更新信息',
    [OperationType.COMMENT]: '添加备注',
    [OperationType.SUBMIT_REVIEW]: '提交运营复核'
  };
  return labels[type];
};

export const getOperationTypeColor = (type: OperationType): string => {
  const colors: Record<OperationType, string> = {
    [OperationType.IMPORT]: 'bg-blue-500',
    [OperationType.REVIEW]: 'bg-violet-500',
    [OperationType.CONFIRM]: 'bg-emerald-500',
    [OperationType.REJECT]: 'bg-red-500',
    [OperationType.UPDATE]: 'bg-amber-500',
    [OperationType.COMMENT]: 'bg-gray-500',
    [OperationType.SUBMIT_REVIEW]: 'bg-orange-500'
  };
  return colors[type];
};

export const getStepLabel = (step: number): string => {
  const labels: Record<number, string> = {
    0: '未开始',
    1: '第一步：脱敏规则导入',
    2: '第二步：补看灰度批次',
    3: '第三步：产品复盘更新'
  };
  return labels[step] || '未知';
};

export const highlightTextDiff = (original: string, transcribed: string): {
  originalHtml: string;
  transcribedHtml: string;
} => {
  const origChars = original.split('');
  const transChars = transcribed.split('');
  
  let originalHtml = '';
  let transcribedHtml = '';
  
  const maxLen = Math.max(origChars.length, transChars.length);
  
  for (let i = 0; i < maxLen; i++) {
    const oChar = origChars[i] || '';
    const tChar = transChars[i] || '';
    
    if (oChar === tChar) {
      originalHtml += oChar;
      transcribedHtml += tChar;
    } else {
      originalHtml += `<span class="bg-emerald-100 text-emerald-800 px-0.5 rounded">${oChar || ' '}</span>`;
      transcribedHtml += `<span class="bg-red-100 text-red-800 px-0.5 rounded">${tChar || ' '}</span>`;
    }
  }
  
  return { originalHtml, transcribedHtml };
};

export const formatDate = (dateStr: string): string => {
  return dateStr;
};
