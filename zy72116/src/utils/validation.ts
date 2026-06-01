import { DataPoint, ValidationResult, ValidationError, ValidationWarning } from '../types';

const VALID_UNITS = ['N', 'kN', 'kgf', 'lbf', '牛', '千牛'];

export function validateData(points: DataPoint[]): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  if (points.length === 0) {
    return {
      isValid: false,
      errors: [{
        type: 'missing_value',
        rowIndex: -1,
        message: '数据为空，请检查上传的文件',
        suggestion: '请确认CSV文件包含有效数据行，表头后至少有一行数据'
      }],
      warnings: []
    };
  }

  points.forEach((point, index) => {
    const rowNum = index + 2;

    if (point.direction === 'unknown') {
      errors.push({
        type: 'direction',
        rowIndex: rowNum,
        message: `第 ${rowNum} 行：方向符号无法识别`,
        suggestion: '请使用"正"或"负"，或英文"positive/negative"，或"+/-"符号'
      });
    }

    if (point.unit && !VALID_UNITS.some(u => point.unit.toLowerCase().includes(u.toLowerCase()))) {
      warnings.push({
        type: 'unit',
        rowIndex: rowNum,
        message: `第 ${rowNum} 行：单位 "${point.unit}" 不是常见的力单位`,
        suggestion: '建议使用 N（牛顿）、kN（千牛）等标准单位'
      });
    }

    if (isNaN(point.centrifugalForce)) {
      errors.push({
        type: 'invalid_number',
        rowIndex: rowNum,
        message: `第 ${rowNum} 行：离心力数值无效`,
        suggestion: '请确保离心力列为有效数字'
      });
    }

    if (point.centrifugalForce === 0 && !point.remark?.includes('零点')) {
      warnings.push({
        type: 'missing_value',
        rowIndex: rowNum,
        message: `第 ${rowNum} 行：离心力为0，可能是缺失值`,
        suggestion: '如果是正常零点，请在备注中说明'
      });
    }
  });

  const timeIntervals: number[] = [];
  for (let i = 1; i < points.length; i++) {
    const interval = points[i].timestamp - points[i - 1].timestamp;
    timeIntervals.push(interval);
  }

  if (timeIntervals.length > 0) {
    const avgInterval = timeIntervals.reduce((a, b) => a + b, 0) / timeIntervals.length;
    const hasIrregularInterval = timeIntervals.some(iv => Math.abs(iv - avgInterval) > avgInterval * 0.5);
    
    if (hasIrregularInterval) {
      warnings.push({
        type: 'time_interval',
        message: '时间间隔不均匀，可能影响分析结果',
        suggestion: '建议使用等时间间隔采样的数据'
      });
    }
  }

  const units = new Set(points.map(p => p.unit).filter(u => u));
  if (units.size > 1) {
    warnings.push({
      type: 'unit',
      message: `检测到多种单位：${Array.from(units).join(', ')}`,
      suggestion: '建议统一单位后再进行分析'
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}
