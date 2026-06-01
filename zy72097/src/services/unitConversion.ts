const STRESS_UNIT_FACTORS: Record<string, number> = {
  'MPa': 1,
  'ksi': 0.145038,
  'kgf/mm²': 0.101972,
  'N/mm²': 1,
};

const LIFE_UNIT_FACTORS: Record<string, (value: number, frequency?: number) => number> = {
  '次': (value) => value,
  '小时': (value, frequency = 10) => value * 3600 * frequency,
  '周': (value, frequency = 10) => value * 7 * 24 * 3600 * frequency,
  '分钟': (value, frequency = 10) => value * 60 * frequency,
  '天': (value, frequency = 10) => value * 24 * 3600 * frequency,
};

const STRESS_UNIT_NAMES: Record<string, string> = {
  'MPa': '兆帕',
  'ksi': '千磅每平方英寸',
  'kgf/mm²': '公斤力每平方毫米',
  'N/mm²': '牛每平方毫米',
};

const LIFE_UNIT_NAMES: Record<string, string> = {
  '次': '循环次数',
  '小时': '小时',
  '周': '周',
  '分钟': '分钟',
  '天': '天',
};

export interface ConversionResult {
  value: number | null;
  formula: string;
  originalUnit: string;
  targetUnit: string;
  originalValue: number | null;
}

export const convertStress = (
  value: number | null,
  fromUnit: string,
  toUnit: string
): ConversionResult => {
  if (value === null) {
    return {
      value: null,
      formula: '数据为空，无法换算',
      originalUnit: fromUnit,
      targetUnit: toUnit,
      originalValue: null,
    };
  }

  const fromFactor = STRESS_UNIT_FACTORS[fromUnit];
  const toFactor = STRESS_UNIT_FACTORS[toUnit];

  if (!fromFactor || !toFactor) {
    return {
      value: null,
      formula: `未知单位: ${fromUnit} 或 ${toUnit}`,
      originalUnit: fromUnit,
      targetUnit: toUnit,
      originalValue: value,
    };
  }

  const mpaValue = value / fromFactor;
  const result = mpaValue * toFactor;

  let formula = '';
  if (fromUnit === 'MPa' && toUnit === 'ksi') {
    formula = `${value} MPa × 0.145038 = ${result.toFixed(2)} ksi`;
  } else if (fromUnit === 'ksi' && toUnit === 'MPa') {
    formula = `${value} ksi ÷ 0.145038 = ${result.toFixed(2)} MPa`;
  } else if (fromUnit === 'MPa' && toUnit === 'kgf/mm²') {
    formula = `${value} MPa × 0.101972 = ${result.toFixed(2)} kgf/mm²`;
  } else if (fromUnit === 'kgf/mm²' && toUnit === 'MPa') {
    formula = `${value} kgf/mm² ÷ 0.101972 = ${result.toFixed(2)} MPa`;
  } else if (fromUnit === toUnit) {
    formula = `单位已为${toUnit}，无需换算`;
  } else {
    formula = `${value} ${fromUnit} ÷ ${fromFactor.toFixed(6)} × ${toFactor.toFixed(6)} = ${result.toFixed(2)} ${toUnit}`;
  }

  return {
    value: result,
    formula,
    originalUnit: fromUnit,
    targetUnit: toUnit,
    originalValue: value,
  };
};

export const convertLife = (
  value: number | null,
  fromUnit: string,
  toUnit: string,
  frequency: number = 10
): ConversionResult => {
  if (value === null) {
    return {
      value: null,
      formula: '数据为空，无法换算',
      originalUnit: fromUnit,
      targetUnit: toUnit,
      originalValue: null,
    };
  }

  const fromConverter = LIFE_UNIT_FACTORS[fromUnit];
  const toConverter = LIFE_UNIT_FACTORS[toUnit];

  if (!fromConverter || !toConverter) {
    return {
      value: null,
      formula: `未知单位: ${fromUnit} 或 ${toUnit}`,
      originalUnit: fromUnit,
      targetUnit: toUnit,
      originalValue: value,
    };
  }

  const cycles = fromConverter(value, frequency);
  const toFactor = toConverter(1, frequency);
  const result = cycles / toFactor;

  let formula = '';
  if (fromUnit === '小时' && toUnit === '次') {
    formula = `${value}小时 × 3600s/h × ${frequency}Hz = ${result.toExponential(2)}次`;
  } else if (fromUnit === '次' && toUnit === '小时') {
    formula = `${value}次 ÷ (3600s/h × ${frequency}Hz) = ${result.toFixed(2)}小时`;
  } else if (fromUnit === toUnit) {
    formula = `单位已为${toUnit}，无需换算`;
  } else {
    formula = `${value}${fromUnit} → 先转次 → ${result.toExponential(2)}${toUnit} (频率${frequency}Hz)`;
  }

  return {
    value: result,
    formula,
    originalUnit: fromUnit,
    targetUnit: toUnit,
    originalValue: value,
  };
};

export const detectUnitMismatch = (units: string[]): boolean => {
  const uniqueUnits = [...new Set(units.filter(u => u))];
  return uniqueUnits.length > 1;
};

export const getAvailableStressUnits = (): string[] => Object.keys(STRESS_UNIT_FACTORS);
export const getAvailableLifeUnits = (): string[] => Object.keys(LIFE_UNIT_FACTORS);

export const getUnitFullName = (unit: string, type: 'stress' | 'life'): string => {
  if (type === 'stress') {
    return STRESS_UNIT_NAMES[unit] || unit;
  }
  return LIFE_UNIT_NAMES[unit] || unit;
};
