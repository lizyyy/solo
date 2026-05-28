export type LinearDensityUnit = 'g/m' | 'kg/m' | 'lb/in';

export interface StringParams {
  id: number;
  name: string;
  scaleLength: number;
  targetNote: string;
  frequency: number;
  linearDensity: number;
  linearDensityUnit: LinearDensityUnit;
  gauge: number;
  rawInputs: {
    scaleLength: string;
    frequency: string;
    linearDensity: string;
    gauge: string;
  };
}

export type AnomalyType = 'OCTAVE_ERROR' | 'UNIT_SUSPICION' | 'TENSION_OVERLIMIT';
export type AnomalySeverity = 'info' | 'warning' | 'danger';

export interface Anomaly {
  type: AnomalyType;
  severity: AnomalySeverity;
  stringId: number;
  message: string;
  suggestion: string;
}

export interface TensionResult {
  stringId: number;
  tension: number;
  isAnomalous: boolean;
  anomalies: Anomaly[];
}

const STANDARD_FREQUENCIES: Record<string, number> = {
  'E2': 82.41, 'F2': 87.31, 'F#2': 92.50, 'G2': 98.00, 'G#2': 103.83, 'A2': 110.00, 'A#2': 116.54, 'B2': 123.47,
  'C3': 130.81, 'C#3': 138.59, 'D3': 146.83, 'D#3': 155.56, 'E3': 164.81, 'F3': 174.61, 'F#3': 185.00, 'G3': 196.00, 'G#3': 207.65, 'A3': 220.00, 'A#3': 233.08, 'B3': 246.94,
  'C4': 261.63, 'C#4': 277.18, 'D4': 293.66, 'D#4': 311.13, 'E4': 329.63, 'F4': 349.23, 'F#4': 369.99, 'G4': 392.00, 'G#4': 415.30, 'A4': 440.00, 'A#4': 466.16, 'B4': 493.88,
  'C5': 523.25, 'D5': 587.33, 'E5': 659.25,
};

export function convertLinearDensityToKgPerM(value: number, unit: LinearDensityUnit): number {
  switch (unit) {
    case 'g/m': return value / 1000;
    case 'kg/m': return value;
    case 'lb/in': return value * 17.858;
  }
}

export function calculateTension(params: StringParams): number {
  const mu = convertLinearDensityToKgPerM(params.linearDensity, params.linearDensityUnit);
  const L = params.scaleLength / 1000;
  const f = params.frequency;
  const T = 4 * mu * L * L * f * f;
  return T;
}

export function detectAnomalies(
  params: StringParams,
  tension: number,
  totalTension: number,
  allStrings: StringParams[]
): Anomaly[] {
  const anomalies: Anomaly[] = [];

  const expectedFreq = STANDARD_FREQUENCIES[params.targetNote];
  if (expectedFreq && params.frequency > 0) {
    const ratio = params.frequency / expectedFreq;
    if (ratio >= 2 || ratio <= 0.5) {
      const direction = ratio >= 2 ? '高' : '低';
      const octaves = Math.round(Math.abs(Math.log2(ratio)));
      anomalies.push({
        type: 'OCTAVE_ERROR',
        severity: 'warning',
        stringId: params.id,
        message: `${params.name}频率${direction}了约${octaves}个八度：输入${params.frequency.toFixed(1)}Hz，${params.targetNote}标准频率${expectedFreq.toFixed(1)}Hz`,
        suggestion: `请确认目标音高是否正确，${params.targetNote}的标准频率应为${expectedFreq.toFixed(1)}Hz`,
      });
    }
  }

  const muKgPerM = convertLinearDensityToKgPerM(params.linearDensity, params.linearDensityUnit);
  if (params.linearDensityUnit === 'g/m') {
    if (params.linearDensity < 0.1) {
      anomalies.push({
        type: 'UNIT_SUSPICION',
        severity: 'warning',
        stringId: params.id,
        message: `${params.name}线密度${params.linearDensity} g/m 过低，疑似误将kg/m值当做g/m输入`,
        suggestion: `若原始数据为${(params.linearDensity * 1000).toFixed(2)} g/m，请更正；若确认为${params.linearDensity} g/m则可忽略`,
      });
    }
    if (params.linearDensity > 50) {
      anomalies.push({
        type: 'UNIT_SUSPICION',
        severity: 'info',
        stringId: params.id,
        message: `${params.name}线密度${params.linearDensity} g/m 异常偏高`,
        suggestion: `请确认是否应为${(params.linearDensity / 1000).toFixed(6)} kg/m`,
      });
    }
  } else if (params.linearDensityUnit === 'kg/m') {
    if (params.linearDensity > 0.01) {
      anomalies.push({
        type: 'UNIT_SUSPICION',
        severity: 'warning',
        stringId: params.id,
        message: `${params.name}线密度${params.linearDensity} kg/m 过高，疑似误将g/m值当做kg/m输入`,
        suggestion: `若原始数据为${(params.linearDensity * 1000).toFixed(2)} g/m，请更正；若确认为${params.linearDensity} kg/m则可忽略`,
      });
    }
    if (params.linearDensity < 0.00005) {
      anomalies.push({
        type: 'UNIT_SUSPICION',
        severity: 'warning',
        stringId: params.id,
        message: `${params.name}线密度${params.linearDensity} kg/m 过低，疑似单位选择错误`,
        suggestion: `若原始数据为${(params.linearDensity * 1000).toFixed(4)} g/m，请更正单位为g/m`,
      });
    }
  }

  if (totalTension > 1000) {
    anomalies.push({
      type: 'TENSION_OVERLIMIT',
      severity: 'danger',
      stringId: params.id,
      message: `总张力${totalTension.toFixed(1)}N 超过危险阈值1000N，琴颈可能受损`,
      suggestion: '建议降低弦径或改用低张力弦，减少总受力',
    });
  } else if (totalTension > 800) {
    anomalies.push({
      type: 'TENSION_OVERLIMIT',
      severity: 'warning',
      stringId: params.id,
      message: `总张力${totalTension.toFixed(1)}N 超过警告阈值800N`,
      suggestion: '建议检查各弦张力是否合理，考虑降低部分弦的规格',
    });
  }

  return anomalies;
}

export function calculateAllTensions(strings: StringParams[]): {
  results: TensionResult[];
  totalTension: number;
  allAnomalies: Anomaly[];
} {
  const preliminaryResults = strings.map(s => ({
    stringId: s.id,
    tension: calculateTension(s),
    isAnomalous: false,
    anomalies: [] as Anomaly[],
  }));

  const totalTension = preliminaryResults.reduce((sum, r) => sum + r.tension, 0);

  const results = strings.map((s, i) => {
    const anomalies = detectAnomalies(s, preliminaryResults[i].tension, totalTension, strings);
    const uniqueAnomalies = anomalies.filter((a, idx, arr) =>
      idx === arr.findIndex(x => x.type === a.type && x.message === a.message)
    );
    return {
      stringId: s.id,
      tension: preliminaryResults[i].tension,
      isAnomalous: uniqueAnomalies.length > 0,
      anomalies: uniqueAnomalies,
    };
  });

  const allAnomalies = results.flatMap(r => r.anomalies);
  const dedupedAnomalies = allAnomalies.filter((a, idx, arr) =>
    idx === arr.findIndex(x => x.type === a.type && x.message === a.message)
  );

  return { results, totalTension, allAnomalies: dedupedAnomalies };
}

export { STANDARD_FREQUENCIES };
