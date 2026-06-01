type UnitCategory = 'length' | 'flow' | 'rainfall';

interface UnitConversion {
  unit: string;
  factor: number;
  category: UnitCategory;
}

const unitConversions: UnitConversion[] = [
  { unit: 'm', factor: 1, category: 'length' },
  { unit: 'cm', factor: 0.01, category: 'length' },
  { unit: 'mm', factor: 0.001, category: 'length' },
  { unit: 'km', factor: 1000, category: 'length' },
  { unit: 'm³/s', factor: 1, category: 'flow' },
  { unit: 'L/s', factor: 0.001, category: 'flow' },
  { unit: 'm³/h', factor: 1 / 3600, category: 'flow' },
  { unit: 'mm/h', factor: 1, category: 'rainfall' },
  { unit: 'mm/min', factor: 60, category: 'rainfall' },
  { unit: 'mm/24h', factor: 1 / 24, category: 'rainfall' },
];

export class UnitConverter {
  static convert(value: number, fromUnit: string, toUnit: string): number {
    const from = unitConversions.find(u => u.unit === fromUnit);
    const to = unitConversions.find(u => u.unit === toUnit);

    if (!from || !to) {
      throw new Error(`不支持的单位转换: ${fromUnit} -> ${toUnit}`);
    }

    if (from.category !== to.category) {
      throw new Error(`单位类别不匹配: ${fromUnit} (${from.category}) -> ${toUnit} (${to.category})`);
    }

    const baseValue = value * from.factor;
    return baseValue / to.factor;
  }

  static getUnitCategory(unit: string): UnitCategory | null {
    const conversion = unitConversions.find(u => u.unit === unit);
    return conversion?.category || null;
  }

  static getStandardUnit(category: UnitCategory): string {
    const standard = unitConversions.find(u => u.category === category && u.factor === 1);
    return standard?.unit || '';
  }

  static normalizeToStandard(value: number, unit: string): { value: number; unit: string } {
    const conversion = unitConversions.find(u => u.unit === unit);
    if (!conversion) {
      return { value, unit };
    }
    const standardUnit = this.getStandardUnit(conversion.category);
    return {
      value: this.convert(value, unit, standardUnit),
      unit: standardUnit
    };
  }
}
