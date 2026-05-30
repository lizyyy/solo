import type { Batch, SamplePoint, ValidationError, TimeUnit } from '@/types';
import { calculateVoltageNoise, standardDeviation, mean } from '../statistics';
import { convertTimeToSeconds } from '../units';

export interface ValidationRule {
  id: string;
  name: string;
  severity: 'error' | 'warning';
  check: (batch: Batch, points: SamplePoint[]) => ValidationError | null;
}

export const validationRules: ValidationRule[] = [
  {
    id: 'resistance-missing',
    name: '电阻值缺失',
    severity: 'error',
    check: (batch) => {
      if (batch.resistance === null) {
        return {
          id: `err-${Date.now()}-resistance`,
          field: 'resistance',
          severity: 'error',
          message: '电阻值 R 未填写',
          target: 'R1',
          suggestion: '请在参数区填写电阻值，这是计算理论时间常数的必要参数',
        };
      }
      return null;
    },
  },
  {
    id: 'capacitance-missing',
    name: '电容值缺失',
    severity: 'error',
    check: (batch) => {
      if (batch.capacitance === null) {
        return {
          id: `err-${Date.now()}-capacitance`,
          field: 'capacitance',
          severity: 'error',
          message: '电容值 C 未填写',
          target: 'C1',
          suggestion: '请在参数区填写电容值，这是计算理论时间常数的必要参数',
        };
      }
      return null;
    },
  },
  {
    id: 'initial-voltage-missing',
    name: '初始电压缺失',
    severity: 'error',
    check: (batch) => {
      if (batch.initialVoltage === null) {
        return {
          id: `err-${Date.now()}-v0`,
          field: 'initialVoltage',
          severity: 'error',
          message: '初始电压 V₀ 未填写',
          target: 'V₀',
          suggestion: '请填写初始电压值，当前使用默认值 0V 可能导致拟合偏差',
        };
      }
      return null;
    },
  },
  {
    id: 'supply-voltage-missing',
    name: '电源电压缺失',
    severity: 'warning',
    check: (batch) => {
      if (batch.supplyVoltage === null && batch.fitMode === 'charge') {
        return {
          id: `err-${Date.now()}-vs`,
          field: 'supplyVoltage',
          severity: 'warning',
          message: '电源电压 Vₛ 未填写',
          target: 'Vₛ',
          suggestion: '充电模式建议填写电源电压，有助于提高拟合精度',
        };
      }
      return null;
    },
  },
  {
    id: 'no-sampling-points',
    name: '无采样数据',
    severity: 'error',
    check: (batch, points) => {
      if (points.length === 0) {
        return {
          id: `err-${Date.now()}-no-points`,
          field: 'samplePoints',
          severity: 'error',
          message: '尚未录入任何采样数据',
          target: '采样数据表',
          suggestion: '请在采样数据表中录入至少3组时间-电压数据点',
        };
      }
      return null;
    },
  },
  {
    id: 'insufficient-sampling-points',
    name: '采样点不足',
    severity: 'warning',
    check: (batch, points) => {
      if (points.length > 0 && points.length < 5) {
        return {
          id: `err-${Date.now()}-few-points`,
          field: 'samplePoints',
          severity: 'warning',
          message: `采样点数量较少 (${points.length}个)`,
          target: '采样数据表',
          suggestion: '建议至少录入10个采样点以获得可靠的拟合结果',
        };
      }
      return null;
    },
  },
  {
    id: 'time-unit-mismatch',
    name: '时间单位可能错误',
    severity: 'warning',
    check: (batch, points) => {
      if (points.length < 3) return null;

      const times = points.map((p) =>
        convertTimeToSeconds(p.time, batch.timeUnit)
      );
      const intervals: number[] = [];
      for (let i = 1; i < times.length; i++) {
        intervals.push(times[i] - times[i - 1]);
      }

      if (intervals.length === 0) return null;

      const avgInterval = mean(intervals);
      const stdInterval = standardDeviation(intervals);

      if (batch.timeUnit === 's' && avgInterval < 0.01 && stdInterval < avgInterval * 0.5) {
        const firstFew = points.slice(0, Math.min(8, points.length));
        return {
          id: `err-${Date.now()}-time-unit`,
          field: 'timeUnit',
          severity: 'warning',
          message: `第1-${firstFew.length}个采样点时间单位可能错误`,
          target: '时间单位',
          suggestion: `平均采样间隔仅 ${(avgInterval * 1000).toFixed(2)}ms，建议检查是否将 ms 误写为 s`,
        };
      }

      if (batch.timeUnit === 'ms' && avgInterval > 10) {
        return {
          id: `err-${Date.now()}-time-unit-2`,
          field: 'timeUnit',
          severity: 'warning',
          message: '时间单位可能错误',
          target: '时间单位',
          suggestion: `平均采样间隔 ${avgInterval.toFixed(2)}s，建议检查是否将 s 误写为 ms`,
        };
      }

      return null;
    },
  },
  {
    id: 'sampling-noise',
    name: '采样噪声过大',
    severity: 'warning',
    check: (batch, points) => {
      if (points.length < 3) return null;

      const voltages = points.map((p) => p.voltage);
      const noise = calculateVoltageNoise(voltages);
      const avgNoise = mean(noise.slice(1));
      const stdNoise = standardDeviation(noise.slice(1));
      const voltageRange = Math.max(...voltages) - Math.min(...voltages);
      const noiseThreshold = voltageRange * 0.05;

      const noisyIndices: number[] = [];
      noise.forEach((n, i) => {
        if (n > noiseThreshold && n > avgNoise + 2 * stdNoise) {
          noisyIndices.push(i + 1);
        }
      });

      if (noisyIndices.length > 0) {
        const sampleIndex = noisyIndices[0];
        const sampleNoise = noise[sampleIndex - 1];
        return {
          id: `err-${Date.now()}-noise`,
          field: 'samplePoints',
          severity: 'warning',
          message: `第${sampleIndex}个采样点噪声过大 (ΔV=${sampleNoise.toFixed(3)}V)`,
          target: `第${sampleIndex}个采样点`,
          suggestion: '建议检查接线是否松动，或重新测量该数据点',
        };
      }

      return null;
    },
  },
  {
    id: 'voltage-range-invalid',
    name: '电压范围异常',
    severity: 'warning',
    check: (batch, points) => {
      if (points.length === 0 || batch.initialVoltage === null) return null;

      const voltages = points.map((p) => p.voltage);
      const minV = Math.min(...voltages);
      const maxV = Math.max(...voltages);

      if (batch.fitMode === 'discharge') {
        if (maxV > batch.initialVoltage * 1.1) {
          return {
            id: `err-${Date.now()}-v-range`,
            field: 'samplePoints',
            severity: 'warning',
            message: `放电过程中出现高于初始电压的测量值`,
            target: '采样数据表',
            suggestion: `最大电压 ${maxV.toFixed(2)}V 超过初始电压 ${batch.initialVoltage.toFixed(2)}V，可能存在接线错误`,
          };
        }
      } else {
        if (batch.supplyVoltage !== null && minV < batch.initialVoltage * 0.9) {
          return {
            id: `err-${Date.now()}-v-range-2`,
            field: 'samplePoints',
            severity: 'warning',
            message: `充电过程中出现低于初始电压的测量值`,
            target: '采样数据表',
            suggestion: `最小电压 ${minV.toFixed(2)}V 低于初始电压 ${batch.initialVoltage.toFixed(2)}V，可能存在接线错误`,
          };
        }
      }

      return null;
    },
  },
  {
    id: 'time-not-monotonic',
    name: '时间序列不单调',
    severity: 'error',
    check: (batch, points) => {
      if (points.length < 2) return null;

      for (let i = 1; i < points.length; i++) {
        if (points[i].time <= points[i - 1].time) {
          return {
            id: `err-${Date.now()}-time-order`,
            field: 'samplePoints',
            severity: 'error',
            message: `第${i + 1}个采样点时间不大于前一个点`,
            target: `第${i + 1}个采样点`,
            suggestion: `时间应严格递增，当前 ${points[i - 1].time} → ${points[i].time}`,
          };
        }
      }

      return null;
    },
  },
  {
    id: 'negative-voltage',
    name: '负电压异常',
    severity: 'warning',
    check: (batch, points) => {
      const negativePoints = points.filter((p) => p.voltage < 0);
      if (negativePoints.length > 0) {
        const firstIdx = points.indexOf(negativePoints[0]) + 1;
        return {
          id: `err-${Date.now()}-neg-v`,
          field: 'samplePoints',
          severity: 'warning',
          message: `第${firstIdx}个采样点出现负电压`,
          target: `第${firstIdx}个采样点`,
          suggestion: 'RC电路中电容电压不应为负，建议检查测量仪器接线',
        };
      }
      return null;
    },
  },
  {
    id: 'resistance-value-range',
    name: '电阻值范围异常',
    severity: 'warning',
    check: (batch) => {
      if (batch.resistance === null) return null;

      let rOhms = batch.resistance;
      if (batch.resistanceUnit === 'kΩ') rOhms *= 1000;
      if (batch.resistanceUnit === 'MΩ') rOhms *= 1000000;

      if (rOhms < 10) {
        return {
          id: `err-${Date.now()}-r-low`,
          field: 'resistance',
          severity: 'warning',
          message: '电阻值过小',
          target: 'R1',
          suggestion: `当前 ${batch.resistance}${batch.resistanceUnit}，电阻过小可能导致充放电过快无法准确测量`,
        };
      }
      if (rOhms > 10e6) {
        return {
          id: `err-${Date.now()}-r-high`,
          field: 'resistance',
          severity: 'warning',
          message: '电阻值过大',
          target: 'R1',
          suggestion: `当前 ${batch.resistance}${batch.resistanceUnit}，电阻过大可能导致漏电流影响增大`,
        };
      }
      return null;
    },
  },
  {
    id: 'capacitance-value-range',
    name: '电容值范围异常',
    severity: 'warning',
    check: (batch) => {
      if (batch.capacitance === null) return null;

      let cFarads = batch.capacitance;
      if (batch.capacitanceUnit === 'μF') cFarads *= 1e-6;
      if (batch.capacitanceUnit === 'nF') cFarads *= 1e-9;
      if (batch.capacitanceUnit === 'pF') cFarads *= 1e-12;

      if (cFarads < 1e-9) {
        return {
          id: `err-${Date.now()}-c-low`,
          field: 'capacitance',
          severity: 'warning',
          message: '电容值过小',
          target: 'C1',
          suggestion: `当前 ${batch.capacitance}${batch.capacitanceUnit}，电容过小可能导致寄生电容影响增大`,
        };
      }
      if (cFarads > 1e-3) {
        return {
          id: `err-${Date.now()}-c-high`,
          field: 'capacitance',
          severity: 'warning',
          message: '电容值过大',
          target: 'C1',
          suggestion: `当前 ${batch.capacitance}${batch.capacitanceUnit}，大电容需注意充电完全性`,
        };
      }
      return null;
    },
  },
];

export const runAllValidations = (
  batch: Batch,
  points: SamplePoint[]
): ValidationError[] => {
  const errors: ValidationError[] = [];

  for (const rule of validationRules) {
    const error = rule.check(batch, points);
    if (error) {
      errors.push(error);
    }
  }

  return errors;
};
