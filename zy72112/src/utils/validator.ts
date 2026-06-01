import type { MeasureField, CheckStep, Judgment } from '../types';

const UNIT_CONVERSIONS: Record<string, Record<string, number>> = {
  length: {
    mm: 1,
    cm: 10,
    m: 1000,
    'μm': 0.001,
    um: 0.001,
    inch: 25.4,
  },
  current: {
    A: 1,
    mA: 0.001,
    kA: 1000,
  },
};

const CATEGORY_MAP: Record<string, 'length' | 'current'> = {
  mm: 'length',
  cm: 'length',
  m: 'length',
  'μm': 'length',
  um: 'length',
  inch: 'length',
  A: 'current',
  mA: 'current',
  kA: 'current',
};

const EXPECTED_UNITS: Record<string, string> = {
  length: 'mm',
  current: 'A',
};

const FIELD_LABELS: Record<string, string> = {
  'gap.calculated': '轨道间隙',
  'height.calculated': '悬浮高度',
  'current.calculated': '推进电流',
  'direction.x': 'X方向偏移',
  'direction.y': 'Y方向偏移',
};

export function convertUnit(
  value: number,
  fromUnit: string,
  toUnit: string,
  category: 'length' | 'current'
): number {
  const table = UNIT_CONVERSIONS[category];
  if (!table[fromUnit] || !table[toUnit]) return value;
  const baseValue = value * table[fromUnit];
  return baseValue / table[toUnit];
}

export function getCategory(unit: string): 'length' | 'current' | null {
  return CATEGORY_MAP[unit] || null;
}

export function getExpectedUnit(unit: string): string {
  const cat = getCategory(unit);
  return cat ? EXPECTED_UNITS[cat] : unit;
}

export function checkUnit(
  field: MeasureField,
  fieldName: string,
  recordIndex: number
): CheckStep {
  const cat = getCategory(field.unit);
  const expected = cat ? EXPECTED_UNITS[cat] : field.unit;
  const needsConversion = field.unit !== expected;
  let judgment: Judgment = 'pass';
  let suggestion = '';
  let description = '';

  if (needsConversion && cat) {
    const converted = convertUnit(field.raw, field.unit, expected, cat);
    judgment = 'warning';
    description = `${fieldName}单位为${field.unit}，标准单位为${expected}`;
    suggestion = `检测到单位不一致：原值 ${field.raw} ${field.unit}，已换算为 ${converted.toFixed(3)} ${expected}。请确认测量时使用的单位是否正确。`;
  } else {
    description = `${fieldName}单位为${field.unit}，符合标准`;
  }

  const fieldLabel = FIELD_LABELS[`${fieldName.toLowerCase()}.calculated`] || fieldName;

  return {
    id: `unit-${recordIndex}-${fieldName}-${Date.now()}`,
    stepOrder: 1,
    checkType: 'unit',
    title: `${fieldLabel}单位校验`,
    description,
    originalValue: `${field.raw} ${field.unit}`,
    calculatedValue: `${field.calculated.toFixed(3)} ${expected}`,
    judgment,
    basis: `标准单位：${expected}`,
    suggestion,
    timestamp: new Date().toISOString(),
  };
}

export function checkDirection(
  x: number,
  y: number,
  recordIndex: number
): CheckStep {
  let judgment: Judgment = 'pass';
  let suggestion = '';
  const parts: string[] = [];

  if (x < -2) {
    judgment = 'warning';
    suggestion = `第${recordIndex + 1}条记录X方向偏移${x.toFixed(2)}mm（向左），请检查轨道左侧导向轮间隙。`;
  } else if (x > 2) {
    judgment = 'warning';
    suggestion = `第${recordIndex + 1}条记录X方向偏移${x.toFixed(2)}mm（向右），请检查轨道右侧导向轮间隙。`;
  }

  if (y < -1) {
    judgment = judgment === 'warning' ? 'error' : 'warning';
    suggestion += ` Y方向偏低${Math.abs(y).toFixed(2)}mm，建议增加悬浮电流0.2A。`;
  } else if (y > 3) {
    judgment = judgment === 'warning' ? 'error' : 'warning';
    suggestion += ` Y方向偏高${y.toFixed(2)}mm，建议降低悬浮电流0.15A。`;
  }

  return {
    id: `dir-${recordIndex}-${Date.now()}`,
    stepOrder: 2,
    checkType: 'direction',
    title: '方向符号校验',
    description: `X方向: ${x > 0 ? '+' : ''}${x.toFixed(2)}mm, Y方向: ${y > 0 ? '+' : ''}${y.toFixed(2)}mm`,
    originalValue: `X=${x}, Y=${y}`,
    calculatedValue: `X=${x > 0 ? '+' : ''}${x.toFixed(2)}, Y=${y > 0 ? '+' : ''}${y.toFixed(2)}`,
    judgment,
    basis: 'X方向±2mm以内正常，Y方向-1mm~+3mm正常',
    suggestion,
    timestamp: new Date().toISOString(),
  };
}

const EXPECTED_INTERVAL = 100;
const TOLERANCE = 10;

export function checkInterval(
  interval: number,
  recordIndex: number,
  isFirst: boolean
): CheckStep {
  if (isFirst) {
    return {
      id: `interval-${recordIndex}-${Date.now()}`,
      stepOrder: 3,
      checkType: 'interval',
      title: '时间间隔校验',
      description: '首条记录，无前置时间对比',
      originalValue: '-',
      calculatedValue: '-',
      judgment: 'pass',
      basis: '',
      suggestion: '',
      timestamp: new Date().toISOString(),
    };
  }

  const diff = Math.abs(interval - EXPECTED_INTERVAL);
  let judgment: Judgment = 'pass';
  let suggestion = '';

  if (diff > TOLERANCE) {
    judgment = interval > EXPECTED_INTERVAL ? 'warning' : 'error';
    if (interval > EXPECTED_INTERVAL) {
      suggestion = `第${recordIndex}条与${recordIndex + 1}条记录间隔${interval}ms，超出正常范围${EXPECTED_INTERVAL}±${TOLERANCE}ms，可能存在数据丢包。`;
    } else {
      suggestion = `第${recordIndex}条与${recordIndex + 1}条记录间隔${interval}ms，采样过于密集，请检查传感器触发设置。`;
    }
  }

  return {
    id: `interval-${recordIndex}-${Date.now()}`,
    stepOrder: 3,
    checkType: 'interval',
    title: '时间间隔校验',
    description: `与上条记录间隔: ${interval}ms`,
    originalValue: `${interval}ms`,
    calculatedValue: `期望${EXPECTED_INTERVAL}±${TOLERANCE}ms`,
    judgment,
    basis: `正常采样间隔: ${EXPECTED_INTERVAL}±${TOLERANCE}ms`,
    suggestion,
    timestamp: new Date().toISOString(),
  };
}

export function validateRecord(
  record: { gap: MeasureField; height: MeasureField; current: MeasureField; direction: { x: number; y: number }; timeSinceLast: number },
  index: number
): CheckStep[] {
  const steps: CheckStep[] = [];
  steps.push(checkUnit(record.gap, 'Gap', index));
  steps.push(checkUnit(record.height, 'Height', index));
  steps.push(checkUnit(record.current, 'Current', index));
  steps.push(checkDirection(record.direction.x, record.direction.y, index));
  steps.push(checkInterval(record.timeSinceLast, index, index === 0));
  return steps;
}
