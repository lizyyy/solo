import dayjs from 'dayjs';

export const formatDate = (date: string | Date, format: string = 'YYYY-MM-DD HH:mm:ss') => {
  return dayjs(date).format(format);
};

export const getDiagnosisTypeLabel = (type: string): string => {
  const labels: Record<string, string> = {
    correct: '正确',
    format_error: '格式错误',
    type_mismatch: '递推类型不匹配',
    wrong_common_difference: '公差错误',
    wrong_common_ratio: '公比错误',
    wrong_coefficient: '系数错误',
    wrong_constant: '常数项错误',
    calculation_error: '计算错误',
    incorrect: '错误',
  };
  return labels[type] || type;
};

export const getDiagnosisTypeColor = (type: string): string => {
  const colors: Record<string, string> = {
    correct: 'success',
    format_error: 'error',
    type_mismatch: 'error',
    wrong_common_difference: 'warning',
    wrong_common_ratio: 'warning',
    wrong_coefficient: 'warning',
    wrong_constant: 'warning',
    calculation_error: 'error',
    incorrect: 'error',
  };
  return colors[type] || 'default';
};

export const getStatusLabel = (status: string): string => {
  const labels: Record<string, string> = {
    pending: '待处理',
    processing: '处理中',
    completed: '已完成',
    failed: '失败',
  };
  return labels[status] || status;
};

export const getStatusColor = (status: string): string => {
  const colors: Record<string, string> = {
    pending: 'default',
    processing: 'processing',
    completed: 'success',
    failed: 'error',
  };
  return colors[status] || 'default';
};

export const downloadFile = (blob: Blob, filename: string) => {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};

export const getErrorTypeName = (errorType: string): string => {
  const typeNames: Record<string, string> = {
    format_error: '格式错误',
    type_mismatch: '递推类型不匹配',
    wrong_common_difference: '公差错误',
    wrong_common_ratio: '公比错误',
    wrong_coefficient: '系数错误',
    wrong_constant: '常数项错误',
    calculation_error: '计算错误',
    correct: '正确',
    incorrect: '错误',
  };
  return typeNames[errorType] || errorType;
};
