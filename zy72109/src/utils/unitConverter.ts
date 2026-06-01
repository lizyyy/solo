import type { TemperatureUnit, PowerUnit, AreaUnit, ThicknessUnit, UnitConversion } from '@/types';

function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}

export class UnitConverter {
  static convertTemperature(value: number, from: TemperatureUnit, to: TemperatureUnit): number {
    if (from === to) return value;

    let celsius: number;
    switch (from) {
      case '°C':
        celsius = value;
        break;
      case '°F':
        celsius = (value - 32) * 5 / 9;
        break;
      case 'K':
        celsius = value - 273.15;
        break;
      default:
        return value;
    }

    switch (to) {
      case '°C':
        return celsius;
      case '°F':
        return celsius * 9 / 5 + 32;
      case 'K':
        return celsius + 273.15;
      default:
        return celsius;
    }
  }

  static convertPower(value: number, from: PowerUnit, to: PowerUnit): number {
    if (from === to) return value;

    const toKw: Record<PowerUnit, number> = {
      'kW': 1,
      'W': 0.001,
      'BTU/h': 0.00029307107,
      'RT': 3.5168528421,
    };

    const kw = value * toKw[from];
    return kw / toKw[to];
  }

  static convertArea(value: number, from: AreaUnit, to: AreaUnit): number {
    if (from === to) return value;

    const toM2: Record<AreaUnit, number> = {
      'm²': 1,
      'ft²': 0.09290304,
    };

    const m2 = value * toM2[from];
    return m2 / toM2[to];
  }

  static convertThickness(value: number, from: ThicknessUnit, to: ThicknessUnit): number {
    if (from === to) return value;

    const toMm: Record<ThicknessUnit, number> = {
      'mm': 1,
      'cm': 10,
      'in': 25.4,
    };

    const mm = value * toMm[from];
    return mm / toMm[to];
  }

  static parseUnit(rawUnit: string): { unit: string; confidence: number; alternatives: string[] } {
    const cleaned = rawUnit.trim().toLowerCase();
    
    const unitPatterns: Record<string, string[]> = {
      '°C': ['°c', 'c', '摄氏度', 'centigrade', 'celsius'],
      '°F': ['°f', 'f', '华氏度', 'fahrenheit'],
      'K': ['k', '开尔文', 'kelvin'],
      'kW': ['kw', '千瓦', 'kilowatt'],
      'W': ['w', '瓦', 'watt'],
      'BTU/h': ['btu', 'btu/h', 'btu/hr', '英热单位'],
      'RT': ['rt', '冷吨', 'refrigeration ton', 'ton'],
      'm²': ['m²', 'm2', '平米', '平方米', 'square meter'],
      'ft²': ['ft²', 'ft2', '平方英尺', 'square foot'],
      'mm': ['mm', '毫米'],
      'cm': ['cm', '厘米'],
      'in': ['in', 'inch', '英寸'],
      '%': ['%', 'percent', '百分之', '相对湿度'],
    };

    const allUnits = Object.keys(unitPatterns);
    
    for (const standardUnit of allUnits) {
      const patterns = unitPatterns[standardUnit];
      if (patterns.includes(cleaned)) {
        return { unit: standardUnit, confidence: 1.0, alternatives: [] };
      }
    }

    const alternatives: { unit: string; score: number }[] = [];
    for (const standardUnit of allUnits) {
      const patterns = unitPatterns[standardUnit];
      for (const pattern of patterns) {
        if (cleaned.includes(pattern) || pattern.includes(cleaned)) {
          const score = Math.max(
            cleaned.length > 0 ? pattern.length / cleaned.length : 0,
            pattern.length > 0 ? cleaned.length / pattern.length : 0
          );
          if (score > 0.3) {
            alternatives.push({ unit: standardUnit, score });
          }
        }
      }
    }

    alternatives.sort((a, b) => b.score - a.score);
    
    if (alternatives.length > 0) {
      const top = alternatives[0];
      return {
        unit: top.unit,
        confidence: Math.min(top.score, 0.9),
        alternatives: alternatives.slice(1, 4).map(a => a.unit),
      };
    }

    return {
      unit: rawUnit,
      confidence: 0,
      alternatives: allUnits.slice(0, 5),
    };
  }

  static getConversionFormula(from: string, to: string): string {
    if (from === to) return `${from} = ${to}`;

    const tempFormulas: Record<string, string> = {
      '°C->°F': '°F = °C × 9/5 + 32',
      '°C->K': 'K = °C + 273.15',
      '°F->°C': '°C = (°F - 32) × 5/9',
      '°F->K': 'K = (°F - 32) × 5/9 + 273.15',
      'K->°C': '°C = K - 273.15',
      'K->°F': '°F = (K - 273.15) × 9/5 + 32',
    };

    const powerFormulas: Record<string, string> = {
      'kW->W': 'W = kW × 1000',
      'kW->BTU/h': 'BTU/h = kW × 3412.14',
      'kW->RT': 'RT = kW ÷ 3.51685',
      'W->kW': 'kW = W ÷ 1000',
      'W->BTU/h': 'BTU/h = W × 3.41214',
      'W->RT': 'RT = W ÷ 3516.85',
      'BTU/h->kW': 'kW = BTU/h × 0.000293',
      'BTU/h->W': 'W = BTU/h × 0.293071',
      'BTU/h->RT': 'RT = BTU/h ÷ 12000',
      'RT->kW': 'kW = RT × 3.51685',
      'RT->W': 'W = RT × 3516.85',
      'RT->BTU/h': 'BTU/h = RT × 12000',
    };

    const areaFormulas: Record<string, string> = {
      'm²->ft²': 'ft² = m² × 10.7639',
      'ft²->m²': 'm² = ft² × 0.092903',
    };

    const thicknessFormulas: Record<string, string> = {
      'mm->cm': 'cm = mm ÷ 10',
      'mm->in': 'in = mm ÷ 25.4',
      'cm->mm': 'mm = cm × 10',
      'cm->in': 'in = cm ÷ 2.54',
      'in->mm': 'mm = in × 25.4',
      'in->cm': 'cm = in × 2.54',
    };

    const key = `${from}->${to}`;
    return tempFormulas[key] || powerFormulas[key] || areaFormulas[key] || thicknessFormulas[key] || `${from} → ${to}`;
  }

  static createConversion(fromUnit: string, toUnit: string, fromValue: number, toValue: number): UnitConversion {
    return {
      id: generateId(),
      fromUnit,
      toUnit,
      fromValue,
      toValue,
      formula: this.getConversionFormula(fromUnit, toUnit),
    };
  }
}
