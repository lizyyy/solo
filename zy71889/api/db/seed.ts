import { getDb } from './database.js';
import { BatchService } from '../services/BatchService.js';
import { ViscosityService } from '../services/ViscosityService.js';
import { CorrectionService } from '../services/CorrectionService.js';
import { ConfirmationService } from '../services/ConfirmationService.js';
import type { SensorLog, ExperimentRecord } from '../../shared/types.js';

function generateSensorLogs(
  count: number,
  baseTime: string,
  options: {
    avgTemp?: number;
    avgDiameter?: number;
    avgFallTime?: number;
    avgFallDistance?: number;
    missingFields?: boolean;
    outOfRange?: boolean;
  } = {}
): Omit<SensorLog, 'id' | 'batchId'>[] {
  const logs: Omit<SensorLog, 'id' | 'batchId'>[] = [];
  const baseDate = new Date(baseTime);

  const avgTemp = options.avgTemp ?? 25;
  const avgDiameter = options.avgDiameter ?? 0.003;
  const avgFallTime = options.avgFallTime ?? 5.5;
  const avgFallDistance = options.avgFallDistance ?? 0.5;

  for (let i = 0; i < count; i++) {
    const timestamp = new Date(baseDate.getTime() + i * 60000).toISOString();

    if (options.missingFields && i % 2 === 0) {
      logs.push({
        timestamp,
        temperature: null,
        sphereDiameter: avgDiameter + (Math.random() - 0.5) * 0.0005,
        fallTime: avgFallTime + (Math.random() - 0.5) * 0.5,
        fallDistance: avgFallDistance + (Math.random() - 0.5) * 0.02,
        rawData: { index: i, note: 'temperature sensor error' },
      });
    } else if (options.outOfRange) {
      logs.push({
        timestamp,
        temperature: 5 + Math.random() * 2,
        sphereDiameter: avgDiameter + (Math.random() - 0.5) * 0.0005,
        fallTime: avgFallTime + (Math.random() - 0.5) * 0.5,
        fallDistance: avgFallDistance + (Math.random() - 0.5) * 0.02,
        rawData: { index: i, note: 'low temperature condition' },
      });
    } else {
      logs.push({
        timestamp,
        temperature: avgTemp + (Math.random() - 0.5) * 2,
        sphereDiameter: avgDiameter + (Math.random() - 0.5) * 0.0005,
        fallTime: avgFallTime + (Math.random() - 0.5) * 0.5,
        fallDistance: avgFallDistance + (Math.random() - 0.5) * 0.02,
        rawData: { index: i, sensorCalibration: 'v2.1' },
      });
    }
  }

  return logs;
}

function generateExperimentRecords(
  baseTime: string,
  studentName: string
): Omit<ExperimentRecord, 'id' | 'batchId'>[] {
  const baseDate = new Date(baseTime);
  return [
    {
      timestamp: new Date(baseDate.getTime() - 3600000).toISOString(),
      type: 'submission',
      content: `${studentName} 提交了液体黏度估计实验报告，包含5次重复测量数据。实验目的：测定甘油在室温下的黏度。实验原理：斯托克斯定律。`,
      author: studentName,
    },
    {
      timestamp: new Date(baseDate.getTime() - 1800000).toISOString(),
      type: 'note',
      content: '实验环境：实验室温度25°C，湿度60%。使用仪器：光电门计时器、螺旋测微器、游标卡尺。',
      author: studentName,
    },
  ];
}

export function seedTestData(): void {
  const db = getDb();

  const existingCount = db.prepare('SELECT COUNT(*) as count FROM experiment_batches').get() as { count: number };
  if (existingCount.count > 0) {
    console.log('Test data already exists, skipping seeding.');
    return;
  }

  const batchService = new BatchService();
  const viscosityService = new ViscosityService();
  const correctionService = new CorrectionService();
  const confirmationService = new ConfirmationService();

  console.log('Seeding test data...');

  const baseTime = new Date('2026-05-30T09:00:00Z').toISOString();

  const normalResult = batchService.createBatch({
    materialId: 'GLYCERIN-001',
    studentId: '202301001',
    studentName: '张明',
    sensorLogs: generateSensorLogs(6, baseTime),
    experimentRecords: generateExperimentRecords(baseTime, '张明'),
  });
  const normalViscosity = viscosityService.runEstimate(normalResult.batch.id);
  correctionService.addCorrection(normalResult.batch.id, {
    content: '实验操作规范，数据记录完整，计算过程正确。黏度估计结果在合理范围内。',
    author: '李助教',
    category: 'praise',
  });
  correctionService.addCorrection(normalResult.batch.id, {
    content: '建议在实验记录中增加对误差来源的分析，例如小球下落时是否保持竖直。',
    author: '李助教',
    category: 'suggestion',
  });

  const duplicateResult = batchService.createBatch({
    materialId: 'GLYCERIN-001',
    studentId: '202301001',
    studentName: '张明',
    sensorLogs: generateSensorLogs(5, new Date('2026-05-31T10:00:00Z').toISOString(), {
      avgFallTime: 5.2,
    }),
    experimentRecords: [
      {
        timestamp: new Date('2026-05-31T09:30:00Z').toISOString(),
        type: 'revision',
        content: '根据上次批改意见，重新进行了实验，特别注意了小球下落的竖直性。',
        author: '张明',
      },
    ],
  });
  const duplicateViscosity = viscosityService.runEstimate(duplicateResult.batch.id);
  correctionService.addCorrection(duplicateResult.batch.id, {
    content: '改进明显，数据质量有所提升。两次实验结果一致性良好。',
    author: '李助教',
    category: 'praise',
  });
  confirmationService.addConfirmation(duplicateResult.batch.id, {
    content: '已复核两次实验数据，确认第二次实验为改进后的重复测量，非新实验。历史数据已保留。',
    confirmer: '王老师',
    relatedItemId: duplicateViscosity.id,
    relatedItemType: 'viscosity_estimate',
  });

  const noLogsResult = batchService.createBatch({
    materialId: 'GLYCERIN-002',
    studentId: '202301002',
    studentName: '李华',
    sensorLogs: [],
    experimentRecords: [
      {
        timestamp: new Date('2026-05-30T14:00:00Z').toISOString(),
        type: 'submission',
        content: '提交实验报告，但传感器数据文件损坏，无法读取。已手动记录部分数据。',
        author: '李华',
      },
    ],
  });
  const noLogsViscosity = viscosityService.runEstimate(noLogsResult.batch.id);
  correctionService.addCorrection(noLogsResult.batch.id, {
    content: '传感器日志缺失，无法进行自动黏度估计。请联系实验中心确认数据备份，或重新进行实验。',
    author: '李助教',
    category: 'error',
    points: 10,
  });
  confirmationService.addConfirmation(noLogsResult.batch.id, {
    content: '已确认数据文件确实损坏，建议安排学生重新进行实验。本次暂不评分。',
    confirmer: '王老师',
  });

  const borderlineResult = batchService.createBatch({
    materialId: 'GLYCERIN-003',
    studentId: '202301003',
    studentName: '王芳',
    sensorLogs: generateSensorLogs(6, new Date('2026-05-30T11:00:00Z').toISOString(), {
      avgFallTime: 4.8,
    }),
    experimentRecords: generateExperimentRecords(new Date('2026-05-30T11:00:00Z').toISOString(), '王芳'),
  });
  const borderlineViscosity = viscosityService.runEstimate(borderlineResult.batch.id);
  correctionService.addCorrection(borderlineResult.batch.id, {
    content: '黏度估计值处于边界区域，需要人工复核。请检查数据采集是否存在系统偏差。',
    author: '李助教',
    category: 'suggestion',
  });
  confirmationService.addConfirmation(borderlineResult.batch.id, {
    content: '已复核原始数据，发现第3次测量的下落时间偏短，可能是光电门触发问题。建议剔除异常值后重新计算。',
    confirmer: '王老师',
    relatedItemId: borderlineViscosity.id,
    relatedItemType: 'viscosity_estimate',
  });

  const incompleteResult = batchService.createBatch({
    materialId: 'GLYCERIN-004',
    studentId: '202301004',
    studentName: '赵强',
    sensorLogs: generateSensorLogs(2, new Date('2026-05-30T13:00:00Z').toISOString(), {
      missingFields: true,
    }),
    experimentRecords: generateExperimentRecords(new Date('2026-05-30T13:00:00Z').toISOString(), '赵强'),
  });
  viscosityService.runEstimate(incompleteResult.batch.id);
  correctionService.addCorrection(incompleteResult.batch.id, {
    content: '有效数据点不足（仅2条完整记录），且温度字段存在缺失。至少需要3条完整记录才能进行可靠估计。',
    author: '李助教',
    category: 'error',
    points: 5,
  });

  const failResult = batchService.createBatch({
    materialId: 'GLYCERIN-005',
    studentId: '202301005',
    studentName: '孙丽',
    sensorLogs: generateSensorLogs(6, new Date('2026-05-30T15:00:00Z').toISOString(), {
      avgFallTime: 3.0,
    }),
    experimentRecords: generateExperimentRecords(new Date('2026-05-30T15:00:00Z').toISOString(), '孙丽'),
  });
  const failViscosity = viscosityService.runEstimate(failResult.batch.id);
  correctionService.addCorrection(failResult.batch.id, {
    content: '黏度估计值明显超出正常范围。检查发现小球下落时间偏短，可能是小球规格选错或液体未达到热平衡。',
    author: '李助教',
    category: 'deduction',
    points: 8,
  });
  correctionService.addCorrection(failResult.batch.id, {
    content: '实验记录中未注明小球直径的具体测量值，请补充。',
    author: '李助教',
    category: 'suggestion',
  });

  console.log('Test data seeded successfully.');
  console.log(`Created batches: normal, duplicate(v2), no-logs, borderline, incomplete, fail`);
}
