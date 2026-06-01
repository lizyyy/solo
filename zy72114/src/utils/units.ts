export type Quantity = 'length' | 'speed' | 'angle' | 'mass' | 'energy' | 'time';

export interface UnitConversion {
  unit: string;
  toStandard: (value: number) => number;
  fromStandard: (value: number) => number;
}

const PI = Math.PI;

const unitDefinitions: Record<Quantity, { standard: string; units: Record<string, UnitConversion> }> = {
  length: {
    standard: 'm',
    units: {
      m: { unit: 'm', toStandard: (v) => v, fromStandard: (v) => v },
      cm: { unit: 'cm', toStandard: (v) => v / 100, fromStandard: (v) => v * 100 },
      mm: { unit: 'mm', toStandard: (v) => v / 1000, fromStandard: (v) => v * 1000 },
      ft: { unit: 'ft', toStandard: (v) => v * 0.3048, fromStandard: (v) => v / 0.3048 },
      in: { unit: 'in', toStandard: (v) => v * 0.0254, fromStandard: (v) => v / 0.0254 },
    },
  },
  speed: {
    standard: 'm/s',
    units: {
      'm/s': { unit: 'm/s', toStandard: (v) => v, fromStandard: (v) => v },
      'km/h': { unit: 'km/h', toStandard: (v) => v / 3.6, fromStandard: (v) => v * 3.6 },
      'ft/s': { unit: 'ft/s', toStandard: (v) => v * 0.3048, fromStandard: (v) => v / 0.3048 },
      mph: { unit: 'mph', toStandard: (v) => v * 0.44704, fromStandard: (v) => v / 0.44704 },
    },
  },
  angle: {
    standard: 'rad',
    units: {
      rad: { unit: 'rad', toStandard: (v) => v, fromStandard: (v) => v },
      deg: { unit: 'deg', toStandard: (v) => (v * PI) / 180, fromStandard: (v) => (v * 180) / PI },
    },
  },
  mass: {
    standard: 'kg',
    units: {
      kg: { unit: 'kg', toStandard: (v) => v, fromStandard: (v) => v },
      g: { unit: 'g', toStandard: (v) => v / 1000, fromStandard: (v) => v * 1000 },
      lb: { unit: 'lb', toStandard: (v) => v * 0.453592, fromStandard: (v) => v / 0.453592 },
    },
  },
  energy: {
    standard: 'J',
    units: {
      J: { unit: 'J', toStandard: (v) => v, fromStandard: (v) => v },
      kJ: { unit: 'kJ', toStandard: (v) => v * 1000, fromStandard: (v) => v / 1000 },
      cal: { unit: 'cal', toStandard: (v) => v * 4.184, fromStandard: (v) => v / 4.184 },
    },
  },
  time: {
    standard: 's',
    units: {
      s: { unit: 's', toStandard: (v) => v, fromStandard: (v) => v },
      ms: { unit: 'ms', toStandard: (v) => v / 1000, fromStandard: (v) => v * 1000 },
    },
  },
};

function findQuantityForUnit(unit: string): Quantity | null {
  for (const [quantity, def] of Object.entries(unitDefinitions)) {
    if (unit in def.units) {
      return quantity as Quantity;
    }
  }
  return null;
}

export function convertValue(value: number, fromUnit: string, toUnit: string): number {
  if (!Number.isFinite(value)) {
    throw new Error(`无效的数值: ${value}`);
  }

  if (value === 0) {
    return 0;
  }

  const fromQuantity = findQuantityForUnit(fromUnit);
  const toQuantity = findQuantityForUnit(toUnit);

  if (!fromQuantity) {
    throw new Error(`未知的源单位: ${fromUnit}`);
  }
  if (!toQuantity) {
    throw new Error(`未知的目标单位: ${toUnit}`);
  }
  if (fromQuantity !== toQuantity) {
    throw new Error(`无法在不同物理量之间换算: ${fromUnit} -> ${toUnit}`);
  }

  const def = unitDefinitions[fromQuantity];
  const fromConv = def.units[fromUnit];
  const toConv = def.units[toUnit];

  const standardValue = fromConv.toStandard(value);
  return toConv.fromStandard(standardValue);
}

export function getStandardUnit(quantity: string): string {
  const q = quantity as Quantity;
  if (!(q in unitDefinitions)) {
    throw new Error(`未知的物理量: ${quantity}`);
  }
  return unitDefinitions[q].standard;
}

export function convertToStandard(
  value: number,
  unit: string,
  quantity: string
): { value: number; unit: string } {
  const q = quantity as Quantity;
  if (!(q in unitDefinitions)) {
    throw new Error(`未知的物理量: ${quantity}`);
  }

  const def = unitDefinitions[q];
  if (!(unit in def.units)) {
    throw new Error(`单位 ${unit} 不属于物理量 ${quantity}`);
  }

  const standardUnit = def.standard;
  const conv = def.units[unit];

  return {
    value: conv.toStandard(value),
    unit: standardUnit,
  };
}

export function isValidUnit(unit: string, quantity: string): boolean {
  const q = quantity as Quantity;
  if (!(q in unitDefinitions)) {
    return false;
  }
  return unit in unitDefinitions[q].units;
}

export function formatValue(value: number, unit: string, decimals?: number): string {
  let formatted: string;

  if (decimals !== undefined) {
    formatted = value.toFixed(decimals);
  } else {
    if (Math.abs(value) >= 1000 || (Math.abs(value) < 0.001 && value !== 0)) {
      formatted = value.toExponential(3);
    } else {
      formatted = parseFloat(value.toPrecision(6)).toString();
    }
  }

  return `${formatted} ${unit}`;
}

export { unitDefinitions };
