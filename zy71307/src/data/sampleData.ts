import type { Experiment, DataPoint } from '@/types';
import { generateId } from '@/utils/math';
import { defaultFittingParams, defaultEnvironmentParams } from '@/utils/storage';

export function generateSampleDataPoints(): DataPoint[] {
  const points: DataPoint[] = [];
  const diameters = [9, 10, 11, 12, 13];
  const baseTimestamp = Date.now() - 86400000;

  diameters.forEach((diameter, diamIndex) => {
    for (let rpm = 1000; rpm <= 6000; rpm += 500) {
      const voltageNoise = (Math.random() - 0.5) * 0.3;
      const voltage = 11.1 + voltageNoise;
      const current = (rpm / 1000) * 1.5 + (Math.random() - 0.5) * 0.2;

      const thrustBase = (rpm / 1000) * (diameter / 10) * 1.2;
      const thrustNoise = (Math.random() - 0.5) * thrustBase * 0.1;
      let thrust = thrustBase + thrustNoise;
      let thrustUnit: 'g' | 'kg' | 'N' | 'lbf' = 'N';

      if (rpm === 3500 && diamIndex === 1) {
        thrust = thrust * 0.6;
      }

      if (rpm === 4000 && diamIndex === 2) {
        thrust = thrust * 1000;
        thrustUnit = 'g';
      }

      const isExcluded = false;

      points.push({
        id: generateId(),
        timestamp: baseTimestamp + diamIndex * 3600000 + (rpm / 500) * 60000,
        rpm,
        voltage,
        current,
        propellerDiameter: diameter,
        thrust,
        thrustUnit,
        isExcluded,
        notes: '',
      });
    }

    points.push({
      id: generateId(),
      timestamp: baseTimestamp + diamIndex * 3600000 + 13 * 60000,
      rpm: 6800,
      voltage: 10.2 + (Math.random() - 0.5) * 0.1,
      current: 9.5 + (Math.random() - 0.5) * 0.3,
      propellerDiameter: diameter,
      thrust: (6800 / 1000) * (diameter / 10) * 1.2 + (Math.random() - 0.5) * 0.2,
      thrustUnit: 'N',
      isExcluded: false,
      notes: '超出计划采样范围',
    });
  });

  return points;
}

export function createSampleExperiment(): Experiment {
  const dataPoints = generateSampleDataPoints();

  return {
    id: generateId(),
    name: '1045桨叶推力测试 - 批次001',
    createdAt: Date.now() - 86400000,
    updatedAt: Date.now(),
    description: '不同桨径下转速-推力关系测试，包含5种桨径（9-13英寸），转速范围1000-6000RPM，步长500RPM。故意引入少量异常数据用于测试。',
    environment: { ...defaultEnvironmentParams },
    dataPoints,
    fittingParams: { ...defaultFittingParams },
    anomalies: [],
    fittingResult: null,
    efficiencyResult: null,
  };
}

export function createEmptyExperiment(): Experiment {
  return {
    id: generateId(),
    name: '新实验批次',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    description: '',
    environment: { ...defaultEnvironmentParams },
    dataPoints: [],
    fittingParams: { ...defaultFittingParams },
    anomalies: [],
    fittingResult: null,
    efficiencyResult: null,
  };
}
