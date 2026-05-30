import { SoundVelocityInput, CalculationResult, CalculationStep } from '../types';
import { PHYSICAL_CONSTANTS, ALGORITHM_VERSION } from '../constants/physics';
import { calculateInputHashTyped, generateId } from '../utils/crypto';
import { convertTimeToSeconds } from '../utils/format';

function createStep(
  stepOrder: number,
  formula: string,
  description: string,
  intermediateValue: number,
  unit: string,
  inputs: Record<string, number | string>
): CalculationStep {
  return {
    id: generateId(),
    stepOrder,
    formula,
    description,
    intermediateValue,
    unit,
    inputs,
  };
}

export function calculateTheoreticalVelocity(temperature: number): { value: number; steps: CalculationStep[] } {
  const steps: CalculationStep[] = [];
  const { SOUND_VELOCITY_AT_0C, ABSOLUTE_ZERO } = PHYSICAL_CONSTANTS;

  steps.push(createStep(
    1,
    'T_kelvin = T_celsius + 273.15',
    '将摄氏温度转换为开尔文温度',
    temperature + 273.15,
    'K',
    { T_celsius: temperature }
  ));

  const tempRatio = 1 + temperature / (ABSOLUTE_ZERO * -1);
  steps.push(createStep(
    2,
    'T_ratio = 1 + T_celsius / 273.15',
    '计算温度比',
    tempRatio,
    '',
    { T_celsius: temperature }
  ));

  const sqrtRatio = Math.sqrt(tempRatio);
  steps.push(createStep(
    3,
    'sqrt(T_ratio) = √(1 + T/273.15)',
    '计算温度比的平方根',
    sqrtRatio,
    '',
    { T_ratio: tempRatio }
  ));

  const velocity = SOUND_VELOCITY_AT_0C * sqrtRatio;
  steps.push(createStep(
    4,
    'v = v₀ × √(1 + T/273.15)',
    '计算理论声速',
    velocity,
    'm/s',
    { v0: SOUND_VELOCITY_AT_0C, sqrt_T_ratio: sqrtRatio }
  ));

  return { value: velocity, steps };
}

export function calculateMeasuredVelocity(
  distance: number,
  timeDiff: number,
  timeUnit: 's' | 'ms'
): { value: number; steps: CalculationStep[] } {
  const steps: CalculationStep[] = [];
  const timeInSeconds = convertTimeToSeconds(timeDiff, timeUnit);

  if (timeUnit === 'ms') {
    steps.push(createStep(
      1,
      't_seconds = t_ms / 1000',
      '将毫秒转换为秒',
      timeInSeconds,
      's',
      { t_ms: timeDiff }
    ));
  }

  steps.push(createStep(
    timeUnit === 'ms' ? 2 : 1,
    'v = distance / time',
    '计算测量声速（单程）',
    distance / timeInSeconds,
    'm/s',
    { distance, time: timeInSeconds }
  ));

  const velocity = distance / timeInSeconds;

  return { value: velocity, steps };
}

export function calculateCalibratedVelocity(
  measuredValue: number,
  deviceDeviation: number
): { value: number; steps: CalculationStep[] } {
  const steps: CalculationStep[] = [];

  steps.push(createStep(
    1,
    'v_calibrated = v_measured + deviation',
    '应用设备偏差进行校准',
    measuredValue + deviceDeviation,
    'm/s',
    { v_measured: measuredValue, deviation: deviceDeviation }
  ));

  return { value: measuredValue + deviceDeviation, steps };
}

export function calculateDeviation(
  theoreticalValue: number,
  measuredValue: number
): { deviation: number; deviationPercent: number; steps: CalculationStep[] } {
  const steps: CalculationStep[] = [];
  const deviation = measuredValue - theoreticalValue;

  steps.push(createStep(
    1,
    'Δv = v_measured - v_theoretical',
    '计算绝对偏差',
    deviation,
    'm/s',
    { v_measured: measuredValue, v_theoretical: theoreticalValue }
  ));

  const deviationPercent = (deviation / theoreticalValue) * 100;
  steps.push(createStep(
    2,
    'Δv% = (Δv / v_theoretical) × 100%',
    '计算相对偏差百分比',
    deviationPercent,
    '%',
    { delta_v: deviation, v_theoretical: theoreticalValue }
  ));

  return { deviation, deviationPercent, steps };
}

export function determineConclusion(
  deviationPercent: number,
  hasErrors: boolean
): 'consistent' | 'inconsistent' | 'warning' {
  if (hasErrors) return 'warning';
  if (Math.abs(deviationPercent) <= PHYSICAL_CONSTANTS.CONSISTENCY_THRESHOLD) {
    return 'consistent';
  }
  return 'inconsistent';
}

export async function calculateSoundVelocity(
  input: SoundVelocityInput
): Promise<CalculationResult> {
  const inputHash = await calculateInputHashTyped(input);
  const allSteps: CalculationStep[] = [];
  let stepCounter = 0;

  const effectiveTemp = input.temperature ?? PHYSICAL_CONSTANTS.DEFAULT_TEMPERATURE;
  if (input.temperature === null) {
    allSteps.push(createStep(
      ++stepCounter,
      'T_effective = 20°C (default)',
      '温度缺失，使用默认标准温度',
      PHYSICAL_CONSTANTS.DEFAULT_TEMPERATURE,
      '℃',
      { default_temp: PHYSICAL_CONSTANTS.DEFAULT_TEMPERATURE }
    ));
  }

  const theoretical = calculateTheoreticalVelocity(effectiveTemp);
  theoretical.steps.forEach(s => {
    allSteps.push({ ...s, stepOrder: ++stepCounter });
  });

  let measuredValue = NaN;
  if (input.distance !== null && input.timeDiff !== null) {
    const measured = calculateMeasuredVelocity(input.distance, input.timeDiff, input.timeUnit);
    measured.steps.forEach(s => {
      allSteps.push({ ...s, stepOrder: ++stepCounter });
    });
    measuredValue = measured.value;
  }

  const effectiveDeviation = input.deviceDeviation ?? PHYSICAL_CONSTANTS.DEFAULT_DEVICE_DEVIATION;
  if (input.deviceDeviation === null) {
    allSteps.push(createStep(
      ++stepCounter,
      'deviation = ±0.5 m/s (default)',
      '设备偏差缺失，使用默认校准值',
      PHYSICAL_CONSTANTS.DEFAULT_DEVICE_DEVIATION,
      'm/s',
      { default_deviation: PHYSICAL_CONSTANTS.DEFAULT_DEVICE_DEVIATION }
    ));
  }

  let calibratedValue = measuredValue;
  if (!Number.isNaN(measuredValue)) {
    const calibrated = calculateCalibratedVelocity(measuredValue, effectiveDeviation);
    calibrated.steps.forEach(s => {
      allSteps.push({ ...s, stepOrder: ++stepCounter });
    });
    calibratedValue = calibrated.value;
  }

  let deviation = NaN;
  let deviationPercent = NaN;
  if (!Number.isNaN(measuredValue)) {
    const devResult = calculateDeviation(theoretical.value, calibratedValue);
    devResult.steps.forEach(s => {
      allSteps.push({ ...s, stepOrder: ++stepCounter });
    });
    deviation = devResult.deviation;
    deviationPercent = devResult.deviationPercent;
  }

  const hasErrors = input.temperature === null || 
                    input.distance === null || 
                    input.timeDiff === null ||
                    input.deviceDeviation === null;

  const conclusion = Number.isNaN(deviationPercent) 
    ? 'warning' 
    : determineConclusion(deviationPercent, hasErrors);

  return {
    id: generateId(),
    inputHash,
    theoreticalValue: theoretical.value,
    measuredValue,
    calibratedValue,
    deviation,
    deviationPercent,
    conclusion,
    calculationSteps: allSteps,
    inputSnapshot: { ...input },
    calculatedAt: Date.now(),
    algorithmVersion: ALGORITHM_VERSION,
  };
}

export async function recalculate(
  originalInput: SoundVelocityInput,
  originalHash: string
): Promise<CalculationResult> {
  const currentHash = await calculateInputHashTyped(originalInput);
  if (currentHash !== originalHash) {
    throw new Error('输入数据已被篡改，无法复算');
  }
  return calculateSoundVelocity(originalInput);
}
