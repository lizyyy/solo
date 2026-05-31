import type { SensorLog, ViscosityEstimate, JudgmentStep } from '../../shared/types.js';

const ALGORITHM_VERSION = '1.0.0';

const THRESHOLDS = {
  VISCOSITY_MIN: 0.8,
  VISCOSITY_MAX: 1.2,
  VISCOSITY_BORDERLINE_TOLERANCE: 0.05,
  TEMPERATURE_MIN: 15,
  TEMPERATURE_MAX: 35,
  SPHERE_DIAMETER_MIN: 0.001,
  SPHERE_DIAMETER_MAX: 0.01,
  FALL_TIME_MIN: 1,
  FALL_TIME_MAX: 30,
  FALL_DISTANCE_MIN: 0.1,
  FALL_DISTANCE_MAX: 1.0,
};

const SPHERE_DENSITY = 7800;
const LIQUID_DENSITY = 1000;
const GRAVITY = 9.81;

export interface ViscosityCalculationResult {
  viscosity: number | null;
  judgment: ViscosityEstimate['judgment'];
  judgmentReason: string;
  judgmentSteps: JudgmentStep[];
  nextSteps: string[];
  rawCalculation: Record<string, any>;
}

export class ViscosityAlgorithm {
  static estimate(sensorLogs: SensorLog[]): ViscosityCalculationResult {
    const judgmentSteps: JudgmentStep[] = [];
    const rawCalculation: Record<string, any> = {};
    const nextSteps: string[] = [];

    rawCalculation.logCount = sensorLogs.length;

    if (sensorLogs.length === 0) {
      return {
        viscosity: null,
        judgment: 'insufficient_data',
        judgmentReason: '未找到传感器日志数据，无法执行液体黏度估计。请检查传感器是否正常工作，或手动导入日志文件。',
        judgmentSteps: [
          {
            step: '传感器日志存在性检查',
            value: 0,
            threshold: 1,
            passed: false,
          },
        ],
        nextSteps: [
          '检查传感器连接状态和数据采集软件',
          '确认实验过程中传感器已正常启动',
          '如有本地日志文件，请手动导入',
          '若数据确实丢失，请登记为异常并安排重测',
        ],
        rawCalculation,
      };
    }

    const validLogs = sensorLogs.filter(
      (log) =>
        log.temperature !== null &&
        log.sphereDiameter !== null &&
        log.fallTime !== null &&
        log.fallDistance !== null
    );

    rawCalculation.validLogCount = validLogs.length;
    rawCalculation.invalidLogCount = sensorLogs.length - validLogs.length;

    judgmentSteps.push({
      step: '完整传感器日志数量检查',
      value: validLogs.length,
      threshold: 3,
      passed: validLogs.length >= 3,
    });

    if (validLogs.length < 3) {
      const missingFields: string[] = [];
      const sample = sensorLogs[0];
      if (sample.temperature === null) missingFields.push('温度');
      if (sample.sphereDiameter === null) missingFields.push('小球直径');
      if (sample.fallTime === null) missingFields.push('下落时间');
      if (sample.fallDistance === null) missingFields.push('下落距离');

      return {
        viscosity: null,
        judgment: 'insufficient_data',
        judgmentReason: `传感器日志数据不完整。共${sensorLogs.length}条记录，其中仅${validLogs.length}条包含完整字段。缺失字段：${missingFields.join('、')}。至少需要3条完整记录才能进行可靠的黏度估计。`,
        judgmentSteps,
        nextSteps: [
          `检查传感器字段映射配置，确认${missingFields.join('、')}字段已正确采集`,
          '检查实验操作流程，确认所有必要参数已录入',
          '如数据可恢复，请补充完整后重新估计',
          '建议人工复核实验记录并手动评估',
        ],
        rawCalculation,
      };
    }

    const avgTemperature = validLogs.reduce((sum, log) => sum + log.temperature!, 0) / validLogs.length;
    const avgDiameter = validLogs.reduce((sum, log) => sum + log.sphereDiameter!, 0) / validLogs.length;
    const avgFallTime = validLogs.reduce((sum, log) => sum + log.fallTime!, 0) / validLogs.length;
    const avgFallDistance = validLogs.reduce((sum, log) => sum + log.fallDistance!, 0) / validLogs.length;

    rawCalculation.avgTemperature = avgTemperature;
    rawCalculation.avgDiameter = avgDiameter;
    rawCalculation.avgFallTime = avgFallTime;
    rawCalculation.avgFallDistance = avgFallDistance;

    judgmentSteps.push({
      step: '环境温度范围检查',
      value: avgTemperature,
      threshold: THRESHOLDS.TEMPERATURE_MAX,
      passed: avgTemperature >= THRESHOLDS.TEMPERATURE_MIN && avgTemperature <= THRESHOLDS.TEMPERATURE_MAX,
    });

    judgmentSteps.push({
      step: '小球直径范围检查',
      value: avgDiameter,
      threshold: THRESHOLDS.SPHERE_DIAMETER_MAX,
      passed: avgDiameter >= THRESHOLDS.SPHERE_DIAMETER_MIN && avgDiameter <= THRESHOLDS.SPHERE_DIAMETER_MAX,
    });

    judgmentSteps.push({
      step: '下落时间范围检查',
      value: avgFallTime,
      threshold: THRESHOLDS.FALL_TIME_MAX,
      passed: avgFallTime >= THRESHOLDS.FALL_TIME_MIN && avgFallTime <= THRESHOLDS.FALL_TIME_MAX,
    });

    judgmentSteps.push({
      step: '下落距离范围检查',
      value: avgFallDistance,
      threshold: THRESHOLDS.FALL_DISTANCE_MAX,
      passed: avgFallDistance >= THRESHOLDS.FALL_DISTANCE_MIN && avgFallDistance <= THRESHOLDS.FALL_DISTANCE_MAX,
    });

    const outOfRangeSteps = judgmentSteps.filter((s) => s.step.includes('范围检查') && !s.passed);

    if (outOfRangeSteps.length > 0) {
      const reasons = outOfRangeSteps.map((s) => {
        const param = s.step.replace('范围检查', '');
        return `${param}(${s.value.toFixed(4)}超出正常范围[${THRESHOLDS[`${param.toUpperCase()}_MIN` as keyof typeof THRESHOLDS]}-${THRESHOLDS[`${param.toUpperCase()}_MAX` as keyof typeof THRESHOLDS]}])`;
      });

      const velocity = avgFallDistance / avgFallTime;
      const viscosity =
        (2 * Math.pow(avgDiameter / 2, 2) * (SPHERE_DENSITY - LIQUID_DENSITY) * GRAVITY) / (9 * velocity);

      rawCalculation.velocity = velocity;
      rawCalculation.viscosity = viscosity;

      return {
        viscosity,
        judgment: 'insufficient_data',
        judgmentReason: `实验参数超出正常范围：${reasons.join('；')}。计算得到的黏度值为${viscosity.toFixed(4)} mPa·s，但由于参数异常，结果可信度不足。`,
        judgmentSteps,
        nextSteps: [
          '检查实验操作是否规范，参数测量是否准确',
          '确认小球规格、液体类型是否与实验要求一致',
          '如为特殊实验条件，请在实验记录中注明并申请人工评估',
          '建议重新进行实验以获取可靠数据',
        ],
        rawCalculation,
      };
    }

    const velocity = avgFallDistance / avgFallTime;
    const viscosity =
      (2 * Math.pow(avgDiameter / 2, 2) * (SPHERE_DENSITY - LIQUID_DENSITY) * GRAVITY) / (9 * velocity);

    rawCalculation.velocity = velocity;
    rawCalculation.viscosity = viscosity;
    rawCalculation.formula = 'η = (2 * r² * (ρ_s - ρ_l) * g) / (9 * v)';
    rawCalculation.sphereDensity = SPHERE_DENSITY;
    rawCalculation.liquidDensity = LIQUID_DENSITY;
    rawCalculation.gravity = GRAVITY;

    judgmentSteps.push({
      step: '黏度估计值范围检查',
      value: viscosity,
      threshold: THRESHOLDS.VISCOSITY_MAX,
      passed: viscosity >= THRESHOLDS.VISCOSITY_MIN && viscosity <= THRESHOLDS.VISCOSITY_MAX,
    });

    const tolerance = THRESHOLDS.VISCOSITY_BORDERLINE_TOLERANCE;
    const isBorderline =
      (viscosity >= THRESHOLDS.VISCOSITY_MIN - tolerance && viscosity < THRESHOLDS.VISCOSITY_MIN) ||
      (viscosity > THRESHOLDS.VISCOSITY_MAX && viscosity <= THRESHOLDS.VISCOSITY_MAX + tolerance);

    let judgment: ViscosityEstimate['judgment'];
    let judgmentReason: string;

    if (viscosity >= THRESHOLDS.VISCOSITY_MIN && viscosity <= THRESHOLDS.VISCOSITY_MAX) {
      judgment = 'pass';
      judgmentReason = `液体黏度估计值为 ${viscosity.toFixed(4)} mPa·s，处于正常范围 [${THRESHOLDS.VISCOSITY_MIN}-${THRESHOLDS.VISCOSITY_MAX}] mPa·s 内。计算基于斯托克斯定律，使用平均参数：温度 ${avgTemperature.toFixed(1)}°C，小球直径 ${(avgDiameter * 1000).toFixed(2)} mm，下落时间 ${avgFallTime.toFixed(2)} s，下落距离 ${(avgFallDistance * 100).toFixed(1)} cm。`;
      nextSteps.push(
        '确认实验操作规范，数据采集完整',
        '检查计算过程是否正确，公式应用无误',
        '可结合人工观察进一步验证结果合理性',
        '如无异议，可完成批改'
      );
    } else if (isBorderline) {
      judgment = 'borderline';
      const distance =
        viscosity < THRESHOLDS.VISCOSITY_MIN
          ? THRESHOLDS.VISCOSITY_MIN - viscosity
          : viscosity - THRESHOLDS.VISCOSITY_MAX;
      judgmentReason = `液体黏度估计值为 ${viscosity.toFixed(4)} mPa·s，处于边界区域。距离正常范围 [${THRESHOLDS.VISCOSITY_MIN}-${THRESHOLDS.VISCOSITY_MAX}] mPa·s 的偏差为 ${distance.toFixed(4)} mPa·s，在容差 ${tolerance} mPa·s 内。平均参数：温度 ${avgTemperature.toFixed(1)}°C，小球直径 ${(avgDiameter * 1000).toFixed(2)} mm，下落时间 ${avgFallTime.toFixed(2)} s，下落距离 ${(avgFallDistance * 100).toFixed(1)} cm。`;
      nextSteps.push(
        '⚠️ 必须进行人工复核，确认边界值的合理性',
        '检查原始传感器数据，排除异常值干扰',
        '对比同批次其他实验结果，确认是否存在系统偏差',
        '必要时要求学生补充实验或说明情况',
        '人工确认后记录确认意见再完成批改'
      );
    } else {
      judgment = 'fail';
      const deviation =
        viscosity < THRESHOLDS.VISCOSITY_MIN
          ? `低于下限 ${(THRESHOLDS.VISCOSITY_MIN - viscosity).toFixed(4)} mPa·s`
          : `高于上限 ${(viscosity - THRESHOLDS.VISCOSITY_MAX).toFixed(4)} mPa·s`;
      judgmentReason = `液体黏度估计值为 ${viscosity.toFixed(4)} mPa·s，超出正常范围 [${THRESHOLDS.VISCOSITY_MIN}-${THRESHOLDS.VISCOSITY_MAX}] mPa·s。偏差：${deviation}。平均参数：温度 ${avgTemperature.toFixed(1)}°C，小球直径 ${(avgDiameter * 1000).toFixed(2)} mm，下落时间 ${avgFallTime.toFixed(2)} s，下落距离 ${(avgFallDistance * 100).toFixed(1)} cm。`;
      nextSteps.push(
        '检查实验操作是否存在明显失误',
        '分析传感器数据是否存在异常波动',
        '确认小球规格和液体类型是否匹配',
        '与学生沟通实验过程，了解是否有特殊情况',
        '可考虑安排重新实验或进行人工评估'
      );
    }

    return {
      viscosity,
      judgment,
      judgmentReason,
      judgmentSteps,
      nextSteps,
      rawCalculation,
    };
  }

  static getAlgorithmVersion(): string {
    return ALGORITHM_VERSION;
  }

  static getThresholds() {
    return { ...THRESHOLDS };
  }
}
