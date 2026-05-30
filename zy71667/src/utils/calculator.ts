import {
  K01,
  TENSION_UNIT_FACTORS,
  DIAMETER_UNIT_FACTORS,
  MATERIALS,
  freqToNoteName,
  type DiameterUnit,
  type TensionUnit,
  type MaterialKey,
} from './constants';

export interface DrumParams {
  id: string;
  diameter: number;
  diameterUnit: DiameterUnit;
  tension: number;
  tensionUnit: TensionUnit;
  material: MaterialKey;
  customDensity: number;
  targetFreq: number;
  targetNote: string;
  notes: string;
  createdAt: number;
}

export interface CalcError {
  field: string;
  type: 'unit_mismatch' | 'octave_misjudge' | 'value_out_of_range' | 'history_overwrite' | 'density_warning';
  message: string;
  recovered: boolean;
}

export interface CalcResult {
  frequency: number;
  requiredTension: number;
  deviation: number;
  centsDiff: number;
  octaveWarning: boolean;
  noteName: string;
  errors: CalcError[];
  tensionInNm: number;
  radiusInM: number;
  densityUsed: number;
}

function diameterToRadiusM(diameter: number, unit: DiameterUnit): number {
  return (diameter * DIAMETER_UNIT_FACTORS[unit]) / 2;
}

function tensionToNm(tension: number, unit: TensionUnit): number {
  return tension * TENSION_UNIT_FACTORS[unit];
}

function nmToTensionUnit(nm: number, unit: TensionUnit): number {
  return nm / TENSION_UNIT_FACTORS[unit];
}

export function calcFrequency(
  tensionNm: number,
  density: number,
  radiusM: number
): number {
  if (radiusM <= 0 || density <= 0 || tensionNm <= 0) return 0;
  return (K01 / (2 * Math.PI)) * Math.sqrt(tensionNm / (density * radiusM * radiusM));
}

export function calcTension(
  frequency: number,
  density: number,
  radiusM: number
): number {
  if (radiusM <= 0 || density <= 0 || frequency <= 0) return 0;
  const ratio = (2 * Math.PI * frequency) / K01;
  return density * radiusM * radiusM * ratio * ratio;
}

export function calcCentsDiff(actual: number, target: number): number {
  if (target <= 0 || actual <= 0) return 0;
  return 1200 * Math.log2(actual / target);
}

export function calcDeviation(actual: number, target: number): number {
  if (target <= 0) return 0;
  return ((actual - target) / target) * 100;
}

export function detectOctaveWarning(frequency: number, targetFreq: number): boolean {
  if (targetFreq <= 0 || frequency <= 0) return false;
  const ratio = frequency / targetFreq;
  const nearDouble = Math.abs(ratio - 2) < 0.08;
  const nearHalf = Math.abs(ratio - 0.5) < 0.08;
  const nearQuad = Math.abs(ratio - 4) < 0.12;
  return nearDouble || nearHalf || nearQuad;
}

export function getDeviationExplanation(
  deviation: number,
  centsDiff: number,
  material: MaterialKey,
  errors: CalcError[]
): string[] {
  const explanations: string[] = [];

  if (errors.length > 0) {
    errors.forEach(e => {
      explanations.push(e.message);
    });
  }

  const absDev = Math.abs(deviation);
  if (absDev <= 2) {
    explanations.push('偏差在 ±2% 以内，调鼓精度优秀。');
  } else if (absDev <= 5) {
    explanations.push('偏差在 2%-5% 之间，对于多数演奏场景已经足够。');
  } else if (absDev <= 10) {
    explanations.push('偏差在 5%-10% 之间，建议微调张力或检查鼓皮安装。');
  } else {
    explanations.push('偏差超过 10%，请检查输入参数是否有误，或考虑鼓皮老化/温度影响。');
  }

  if (material === 'calf' && absDev > 8) {
    explanations.push('小牛皮鼓皮受温湿度影响显著，建议在稳定环境下测量后再调。');
  }

  if (material === 'kevlar' && absDev > 5) {
    explanations.push('Kevlar 鼓皮通常张力很高，确保使用专用调鼓扳手，避免过载。');
  }

  const absCents = Math.abs(centsDiff);
  if (absCents > 0 && absCents <= 10) {
    explanations.push(`音分差 ${centsDiff.toFixed(1)} 音分，几乎听不出偏差。`);
  } else if (absCents > 10 && absCents <= 50) {
    explanations.push(`音分差 ${centsDiff.toFixed(1)} 音分，轻微走音，敏感耳朵可辨别。`);
  } else if (absCents > 50) {
    explanations.push(`音分差 ${centsDiff.toFixed(1)} 音分，偏差明显，建议重新调鼓。`);
  }

  return explanations;
}

export function validateAndCalculate(params: DrumParams): CalcResult {
  const errors: CalcError[] = [];

  if (params.diameter <= 0) {
    errors.push({
      field: 'diameter',
      type: 'value_out_of_range',
      message: '鼓皮直径必须大于 0，已使用边界值 1 英寸继续计算。',
      recovered: true,
    });
    params = { ...params, diameter: 1 };
  }

  if (params.tension <= 0) {
    errors.push({
      field: 'tension',
      type: 'value_out_of_range',
      message: '张力值必须大于 0，已使用边界值 100 N/m 继续计算。',
      recovered: true,
    });
    params = { ...params, tension: 100, tensionUnit: 'N/m' };
  }

  if (params.tension > 50000 && params.tensionUnit === 'N/m') {
    errors.push({
      field: 'tension',
      type: 'value_out_of_range',
      message: `张力值 ${params.tension} N/m 异常偏高，已标记但继续计算。请确认单位是否正确。`,
      recovered: true,
    });
  }

  if (params.tensionUnit !== 'N/m') {
    const nmValue = tensionToNm(params.tension, params.tensionUnit);
    if (nmValue > 50000) {
      errors.push({
        field: 'tension',
        type: 'unit_mismatch',
        message: `换算后张力 ${nmValue.toFixed(1)} N/m 异常偏高，请确认 ${params.tensionUnit} 单位是否正确。已继续计算。`,
        recovered: true,
      });
    }
  }

  const radiusM = diameterToRadiusM(params.diameter, params.diameterUnit);
  const tensionNm = tensionToNm(params.tension, params.tensionUnit);
  const density = params.material === 'custom' ? params.customDensity : MATERIALS[params.material].density;

  if (density <= 0) {
    errors.push({
      field: 'customDensity',
      type: 'value_out_of_range',
      message: '自定义面密度必须大于 0，已回退到 Mylar 默认值 0.19 kg/m²。',
      recovered: true,
    });
  }

  if (params.material === 'calf') {
    errors.push({
      field: 'material',
      type: 'density_warning',
      message: '小牛皮面密度受老化影响可能偏差 10%-20%，结果仅供参考。',
      recovered: true,
    });
  }

  const effectiveDensity = density > 0 ? density : 0.19;
  const frequency = calcFrequency(tensionNm, effectiveDensity, radiusM);
  const requiredTensionNm = params.targetFreq > 0
    ? calcTension(params.targetFreq, effectiveDensity, radiusM)
    : 0;
  const requiredTension = params.targetFreq > 0
    ? nmToTensionUnit(requiredTensionNm, params.tensionUnit)
    : 0;

  let deviation = 0;
  let centsDiff = 0;
  let octaveWarning = false;

  if (params.targetFreq > 0 && frequency > 0) {
    deviation = calcDeviation(frequency, params.targetFreq);
    centsDiff = calcCentsDiff(frequency, params.targetFreq);
    octaveWarning = detectOctaveWarning(frequency, params.targetFreq);
    if (octaveWarning) {
      errors.push({
        field: 'targetFreq',
        type: 'octave_misjudge',
        message: `计算频率 ${frequency.toFixed(1)} Hz 与目标频率 ${params.targetFreq.toFixed(1)} Hz 之间存在倍频关系，可能是目标音高选错了八度。已标注但未阻断。`,
        recovered: true,
      });
    }
  }

  const noteName = freqToNoteName(frequency);

  return {
    frequency,
    requiredTension,
    deviation,
    centsDiff,
    octaveWarning,
    noteName,
    errors,
    tensionInNm: tensionNm,
    radiusInM: radiusM,
    densityUsed: effectiveDensity,
  };
}

export function generateCurveData(
  diameter: number,
  diameterUnit: DiameterUnit,
  material: MaterialKey,
  customDensity: number,
  tensionUnit: TensionUnit,
  pointCount: number = 100
): { tensions: number[]; frequencies: number[]; tensionsOriginal: number[] } {
  const radiusM = diameterToRadiusM(diameter, diameterUnit);
  const density = material === 'custom' ? customDensity : MATERIALS[material].density;
  if (radiusM <= 0 || density <= 0) return { tensions: [], frequencies: [], tensionsOriginal: [] };

  const minTensionNm = 200;
  const maxTensionNm = 15000;
  const tensionsNm: number[] = [];
  const frequencies: number[] = [];
  const tensionsOriginal: number[] = [];

  for (let i = 0; i < pointCount; i++) {
    const t = minTensionNm + (maxTensionNm - minTensionNm) * (i / (pointCount - 1));
    tensionsNm.push(t);
    frequencies.push(calcFrequency(t, density, radiusM));
    tensionsOriginal.push(nmToTensionUnit(t, tensionUnit));
  }

  return { tensions: tensionsNm, frequencies, tensionsOriginal };
}
