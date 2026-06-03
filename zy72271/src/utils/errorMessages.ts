import type { ValidationError } from '../types';

export const formatHumanReadableError = (
  errorCode: string,
  context?: Record<string, string | number>
): ValidationError => {
  const errorMap: Record<string, Omit<ValidationError, 'field'>> = {
    'cad_layer_invalid': {
      message: 'CAD图层名称不符合规范，请检查导入的图层文件',
      suggestion: '请确认图层名称是否为空或包含非法字符',
    },
    'cad_layer_empty': {
      message: `图层 "${context?.layerName}" 名称不能为空`,
      suggestion: '请检查CAD文件，确保所有图层命名完整',
    },
    'distance_out_of_range': {
      message: `测距值 ${context?.value} ${context?.unit} 超出合理范围`,
      suggestion: '请确认是否为旧口径数据，或检查测距仪是否正常工作',
    },
    'caliber_mismatch': {
      message: '数据口径不匹配：当前使用的是旧口径标准',
      suggestion: '请转换为当前标准口径（公制/米），或申请人工修正',
    },
    'caliber_mismatch_imperial': {
      message: '数据口径不匹配：当前使用的是英尺单位',
      suggestion: '需要人工修正为公制单位（米），1 英尺 = 0.3048 米',
    },
    'warning_label_blocked': {
      message: '照片中的红色告警标签被移动端截图挡住了',
      suggestion: '请标记此异常后提交施工经理复核，不要直接判定为正常',
    },
    'warning_label_missing': {
      message: '未检测到红色告警标签',
      suggestion: '请确认照片中是否包含测距仪屏幕截图的完整画面',
    },
    'unit_mismatch': {
      message: `单位不匹配：期望 "${context?.expected}"，实际 "${context?.actual}"`,
      suggestion: '请检查测距仪设置，或进行单位转换',
    },
    'correction_required': {
      message: '此记录需要人工修正',
      suggestion: '请在修正表单中填写正确的数值和修正原因',
    },
    'manager_review_pending': {
      message: '此记录正在等待施工经理复核',
      suggestion: '请联系施工经理确认处理，或查看复核进度',
    },
    'report_generation_failed': {
      message: '安全距离报告生成失败',
      suggestion: '请检查数据是否完整，或重试生成',
    },
  };

  const error = errorMap[errorCode] || {
    message: `未知错误: ${errorCode}`,
    suggestion: '请联系系统管理员',
  };

  return {
    field: context?.field as string || 'unknown',
    ...error,
  };
};

export const getErrorMessage = (errorCode: string, context?: Record<string, string | number>): string => {
  const error = formatHumanReadableError(errorCode, context);
  return error.message;
};

export const getErrorSuggestion = (errorCode: string, context?: Record<string, string | number>): string => {
  const error = formatHumanReadableError(errorCode, context);
  return error.suggestion;
};
