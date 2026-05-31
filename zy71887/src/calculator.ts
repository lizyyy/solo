import { CollisionCalculation, Anomaly, RawCollisionData, CalibrationTable } from './types';

const GRAVITY = 9.8;

export class CollisionCalculator {
  private calibration: CalibrationTable;

  constructor(calibration: CalibrationTable) {
    this.calibration = calibration;
  }

  calculate(rawData: RawCollisionData): CollisionCalculation {
    const height = rawData.initialHeight / 100;
    const initialVelocity = Math.sqrt(2 * GRAVITY * height);

    const initialMomentum = rawData.ballMass * initialVelocity;

    const timeToFall = Math.sqrt(2 * height / GRAVITY);
    const collisionVelocity = (rawData.collisionDisplacement / 100) / timeToFall;

    const collisionMomentum = rawData.ballMass * collisionVelocity;

    const momentumLossRate = initialMomentum > 0
      ? ((initialMomentum - collisionMomentum) / initialMomentum) * 100
      : 0;

    const kineticEnergyBefore = 0.5 * rawData.ballMass * initialVelocity * initialVelocity;
    const kineticEnergyAfter = 0.5 * rawData.ballMass * collisionVelocity * collisionVelocity;

    const energyLossRate = kineticEnergyBefore > 0
      ? ((kineticEnergyBefore - kineticEnergyAfter) / kineticEnergyBefore) * 100
      : 0;

    return {
      initialVelocity,
      initialMomentum,
      collisionVelocity,
      collisionMomentum,
      momentumLossRate,
      kineticEnergyBefore,
      kineticEnergyAfter,
      energyLossRate
    };
  }

  detectAnomalies(rawData: RawCollisionData, calculation: CollisionCalculation): Anomaly[] {
    const anomalies: Anomaly[] = [];

    if (calculation.momentumLossRate > 30) {
      anomalies.push({
        type: 'momentum_loss',
        severity: 'error',
        message: `动量损失率过高: ${calculation.momentumLossRate.toFixed(1)}%`,
        explanation: '理论上碰撞过程动量守恒，损失率应在5%以内。超过30%可能是实验操作问题（如碰撞角度偏差、轨道不水平）或数据记录错误。',
        suggestion: '请检查：1) 碰撞时两球是否对心；2) 轨道是否水平；3) 读数是否准确。建议重新实验或核实原始数据。',
        expectedRange: [0, 30],
        actualValue: calculation.momentumLossRate
      });
    } else if (calculation.momentumLossRate > 10) {
      anomalies.push({
        type: 'momentum_loss',
        severity: 'warning',
        message: `动量损失率偏高: ${calculation.momentumLossRate.toFixed(1)}%`,
        explanation: '理想情况下动量守恒，损失率应在5%以内。超过10%可能存在系统误差。',
        suggestion: '请检查轨道水平度和碰撞位置，确认数据记录无误。',
        expectedRange: [0, 10],
        actualValue: calculation.momentumLossRate
      });
    }

    if (calculation.energyLossRate > 70) {
      anomalies.push({
        type: 'energy_loss',
        severity: 'error',
        message: `能量损失率过高: ${calculation.energyLossRate.toFixed(1)}%`,
        explanation: '非弹性碰撞会有能量损失，但超过70%可能表明实验问题。可能原因：碰撞不完全、轨道摩擦过大、读数错误。',
        suggestion: '请检查钢球表面是否清洁，碰撞位置是否正确，确认数据读数无误。',
        expectedRange: [0, 70],
        actualValue: calculation.energyLossRate
      });
    }

    if (rawData.ballMass < 0.05 || rawData.ballMass > 0.15) {
      anomalies.push({
        type: 'unit_error',
        severity: 'error',
        message: `钢球质量异常: ${rawData.ballMass} kg`,
        explanation: '标准钢球质量通常在0.06-0.1kg范围内。当前值可能存在单位混淆（克误写为千克）。',
        suggestion: `请检查单位。若原始记录为${rawData.ballMass}克，则应为${(rawData.ballMass / 1000).toFixed(4)} kg。`,
        field: 'ballMass',
        expectedRange: [0.05, 0.15],
        actualValue: rawData.ballMass
      });
    }

    if (rawData.ballDiameter < 0.01 || rawData.ballDiameter > 0.05) {
      anomalies.push({
        type: 'unit_error',
        severity: 'error',
        message: `钢球直径异常: ${rawData.ballDiameter} m`,
        explanation: '标准钢球直径通常在0.02-0.03m范围内。当前值可能存在单位混淆（毫米或厘米误写为米）。',
        suggestion: `请检查单位。若原始记录为${rawData.ballDiameter}厘米，则应为${(rawData.ballDiameter / 100).toFixed(4)} m。`,
        field: 'ballDiameter',
        expectedRange: [0.01, 0.05],
        actualValue: rawData.ballDiameter
      });
    }

    if (rawData.initialHeight < 5 || rawData.initialHeight > 20) {
      anomalies.push({
        type: 'outlier',
        severity: 'warning',
        message: `初始高度异常: ${rawData.initialHeight} cm`,
        explanation: '实验通常在高度10-15cm范围内进行。当前值超出正常范围。',
        suggestion: '请确认高度读数是否正确，是否按实验要求设置。',
        field: 'initialHeight',
        expectedRange: [5, 20],
        actualValue: rawData.initialHeight
      });
    }

    if (!rawData.ballMass || !rawData.initialHeight || !rawData.horizontalDisplacement || !rawData.collisionDisplacement) {
      anomalies.push({
        type: 'missing_data',
        severity: 'error',
        message: '存在必填数据缺失',
        explanation: '计算动量守恒需要质量、高度、位移等完整数据。',
        suggestion: '请补全缺失的实验数据后重新导入。'
      });
    }

    return anomalies;
  }
}

export function getDefaultCalibration(): CalibrationTable {
  return {
    version: '1.0',
    effectiveDate: new Date().toISOString().split('T')[0],
    configs: [
      {
        id: 'mass',
        name: '钢球质量',
        unit: 'kg',
        standardValue: 0.067,
        tolerance: 0.005,
        conversionFactor: 0.001,
        description: '克转千克'
      },
      {
        id: 'length',
        name: '长度测量',
        unit: 'cm',
        standardValue: 1,
        tolerance: 0.1,
        conversionFactor: 0.01,
        description: '厘米转米'
      }
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}
