import { Unit } from '@shared/types';

export const STANDARD_UNITS: Unit[] = [
  { id: 'g', name: '克', symbol: 'g', type: 'weight', conversionFactor: 1 },
  { id: 'kg', name: '千克', symbol: 'kg', type: 'weight', conversionFactor: 1000 },
  { id: 'mg', name: '毫克', symbol: 'mg', type: 'weight', conversionFactor: 0.001 },
  { id: 'oz', name: '盎司', symbol: 'oz', type: 'weight', conversionFactor: 28.3495 },
  { id: 'lb', name: '磅', symbol: 'lb', type: 'weight', conversionFactor: 453.592 },
  { id: 'ml', name: '毫升', symbol: 'ml', type: 'volume', conversionFactor: 1 },
  { id: 'l', name: '升', symbol: 'L', type: 'volume', conversionFactor: 1000 },
  { id: 'tsp', name: '茶匙', symbol: 'tsp', type: 'volume', conversionFactor: 5 },
  { id: 'tbsp', name: '汤匙', symbol: 'tbsp', type: 'volume', conversionFactor: 15 },
  { id: 'cup', name: '杯', symbol: 'cup', type: 'volume', conversionFactor: 240 },
  { id: 'piece', name: '个', symbol: '个', type: 'count', conversionFactor: 1 },
  { id: 'slice', name: '片', symbol: '片', type: 'count', conversionFactor: 1 },
  { id: 'clove', name: '瓣', symbol: '瓣', type: 'count', conversionFactor: 1 },
  { id: 'bunch', name: '束', symbol: '束', type: 'count', conversionFactor: 1 },
];

const COMMON_INGREDIENT_DENSITY: Record<string, number> = {
  '面粉': 0.52,
  '白糖': 0.85,
  '红糖': 0.85,
  '黄油': 0.91,
  '牛奶': 1.03,
  '水': 1.0,
  '油': 0.92,
  '蜂蜜': 1.42,
  '盐': 1.2,
};

export function getUnitById(unitId: string): Unit | undefined {
  return STANDARD_UNITS.find(u => u.id.toLowerCase() === unitId.toLowerCase());
}

export function convertUnit(
  quantity: number,
  fromUnitId: string,
  toUnitId: string,
  ingredientName?: string
): number {
  const fromUnit = getUnitById(fromUnitId);
  const toUnit = getUnitById(toUnitId);

  if (!fromUnit || !toUnit) {
    return quantity;
  }

  if (fromUnit.type === toUnit.type) {
    const fromStandard = quantity * fromUnit.conversionFactor;
    return fromStandard / toUnit.conversionFactor;
  }

  if (fromUnit.type === 'volume' && toUnit.type === 'weight') {
    const density = ingredientName ? COMMON_INGREDIENT_DENSITY[ingredientName] || 1 : 1;
    const mlQuantity = quantity * fromUnit.conversionFactor;
    const grams = mlQuantity * density;
    return grams / toUnit.conversionFactor;
  }

  if (fromUnit.type === 'weight' && toUnit.type === 'volume') {
    const density = ingredientName ? COMMON_INGREDIENT_DENSITY[ingredientName] || 1 : 1;
    const grams = quantity * fromUnit.conversionFactor;
    const mlQuantity = grams / density;
    return mlQuantity / toUnit.conversionFactor;
  }

  return quantity;
}

export function normalizeToGrams(quantity: number, unitId: string, ingredientName?: string): number {
  const unit = getUnitById(unitId);
  if (!unit) return quantity;

  if (unit.type === 'weight') {
    return quantity * unit.conversionFactor;
  }

  if (unit.type === 'volume') {
    const density = ingredientName ? COMMON_INGREDIENT_DENSITY[ingredientName] || 1 : 1;
    const mlQuantity = quantity * unit.conversionFactor;
    return mlQuantity * density;
  }

  return quantity;
}

export function getBestDisplayUnit(grams: number, preferredType?: UnitType): { quantity: number; unit: Unit } {
  let units = STANDARD_UNITS.filter(u => u.type === 'weight');
  
  if (preferredType) {
    units = STANDARD_UNITS.filter(u => u.type === preferredType);
  }

  const preferredMetricUnits = units.filter(u => ['g', 'kg', 'ml', 'l', 'piece'].includes(u.id));
  
  let bestUnit = preferredMetricUnits[0];
  let bestQuantity = grams;

  for (const unit of preferredMetricUnits) {
    const converted = grams / unit.conversionFactor;
    if (converted >= 1 && (converted < bestQuantity || bestQuantity === grams)) {
      bestUnit = unit;
      bestQuantity = converted;
    }
  }

  return { quantity: bestQuantity, unit: bestUnit };
}

export function roundQuantity(quantity: number, precision: number = 2): number {
  return Math.round(quantity * Math.pow(10, precision)) / Math.pow(10, precision);
}

export function roundToPracticalQuantity(quantity: number): number {
  if (quantity <= 0) return 0;
  
  if (quantity < 0.1) {
    return Math.ceil(quantity * 100) / 100;
  } else if (quantity < 1) {
    return Math.ceil(quantity * 10) / 10;
  } else if (quantity < 10) {
    return Math.ceil(quantity * 2) / 2;
  } else {
    return Math.ceil(quantity);
  }
}
