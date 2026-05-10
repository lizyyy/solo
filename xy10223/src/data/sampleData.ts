import type { Batch } from '../types';
import { FermentationStage, DoughType } from '../types';

export const generateSampleBatches = (): Batch[] => {
  const now = new Date();
  const batches: Batch[] = [];

  batches.push({
    id: 'sample_batch_1',
    batchNumber: '20240510-001',
    doughType: DoughType.WHITE,
    weight: 2000,
    targetTemperature: 24,
    createdAt: new Date(now.getTime() - 8 * 60 * 60 * 1000).toISOString(),
    currentStage: FermentationStage.FINAL_PROOF,
    stageTransitions: [
      {
        fromStage: null,
        toStage: FermentationStage.PRE_FERMENT,
        timestamp: new Date(now.getTime() - 8 * 60 * 60 * 1000).toISOString(),
        note: '开始预发酵，水温22℃'
      },
      {
        fromStage: FermentationStage.PRE_FERMENT,
        toStage: FermentationStage.BULK_FERMENT,
        timestamp: new Date(now.getTime() - 5 * 60 * 60 * 1000).toISOString(),
        note: '预发酵完成，体积增加2倍'
      },
      {
        fromStage: FermentationStage.BULK_FERMENT,
        toStage: FermentationStage.BENCH_REST,
        timestamp: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(),
        note: '基础发酵完成，排气良好'
      },
      {
        fromStage: FermentationStage.BENCH_REST,
        toStage: FermentationStage.FINAL_PROOF,
        timestamp: new Date(now.getTime() - 30 * 60 * 1000).toISOString(),
        note: '整形完成，进入醒发箱'
      }
    ],
    temperatureRecords: [
      {
        id: 'temp_1',
        batchId: 'sample_batch_1',
        stage: FermentationStage.PRE_FERMENT,
        temperature: 23.5,
        recordedAt: new Date(now.getTime() - 7.5 * 60 * 60 * 1000).toISOString(),
        note: '正常'
      },
      {
        id: 'temp_2',
        batchId: 'sample_batch_1',
        stage: FermentationStage.PRE_FERMENT,
        temperature: 24.2,
        recordedAt: new Date(now.getTime() - 6.5 * 60 * 60 * 1000).toISOString(),
        note: '温度略有上升'
      },
      {
        id: 'temp_3',
        batchId: 'sample_batch_1',
        stage: FermentationStage.BULK_FERMENT,
        temperature: 25.0,
        recordedAt: new Date(now.getTime() - 4 * 60 * 60 * 1000).toISOString(),
        note: '理想温度'
      },
      {
        id: 'temp_4',
        batchId: 'sample_batch_1',
        stage: FermentationStage.BULK_FERMENT,
        temperature: 24.8,
        recordedAt: new Date(now.getTime() - 3 * 60 * 60 * 1000).toISOString(),
        note: '稳定'
      },
      {
        id: 'temp_5',
        batchId: 'sample_batch_1',
        stage: FermentationStage.FINAL_PROOF,
        temperature: 28.0,
        recordedAt: new Date(now.getTime() - 20 * 60 * 1000).toISOString(),
        note: '醒发箱温度正常'
      }
    ],
    notes: '这批面团用于制作法棍'
  });

  batches.push({
    id: 'sample_batch_2',
    batchNumber: '20240510-002',
    doughType: DoughType.WHOLE_WHEAT,
    weight: 1500,
    targetTemperature: 26,
    createdAt: new Date(now.getTime() - 12 * 60 * 60 * 1000).toISOString(),
    currentStage: FermentationStage.COMPLETED,
    stageTransitions: [
      {
        fromStage: null,
        toStage: FermentationStage.PRE_FERMENT,
        timestamp: new Date(now.getTime() - 12 * 60 * 60 * 1000).toISOString(),
        note: '预发酵开始，使用100%天然酵母'
      },
      {
        fromStage: FermentationStage.PRE_FERMENT,
        toStage: FermentationStage.BULK_FERMENT,
        timestamp: new Date(now.getTime() - 9 * 60 * 60 * 1000).toISOString(),
        note: '天然酵母活性良好'
      },
      {
        fromStage: FermentationStage.BULK_FERMENT,
        toStage: FermentationStage.BENCH_REST,
        timestamp: new Date(now.getTime() - 5 * 60 * 60 * 1000).toISOString(),
        note: '发酵充分'
      },
      {
        fromStage: FermentationStage.BENCH_REST,
        toStage: FermentationStage.FINAL_PROOF,
        timestamp: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(),
        note: '整形为圆形面包'
      },
      {
        fromStage: FermentationStage.FINAL_PROOF,
        toStage: FermentationStage.COMPLETED,
        timestamp: new Date(now.getTime() - 10 * 60 * 1000).toISOString(),
        note: '已进入烤箱，180℃ 25分钟'
      }
    ],
    temperatureRecords: [
      {
        id: 'temp_6',
        batchId: 'sample_batch_2',
        stage: FermentationStage.PRE_FERMENT,
        temperature: 25.0,
        recordedAt: new Date(now.getTime() - 11 * 60 * 60 * 1000).toISOString(),
        note: '天然酵母需要稍高温度'
      },
      {
        id: 'temp_7',
        batchId: 'sample_batch_2',
        stage: FermentationStage.BULK_FERMENT,
        temperature: 26.5,
        recordedAt: new Date(now.getTime() - 7 * 60 * 60 * 1000).toISOString(),
        note: '温度理想'
      },
      {
        id: 'temp_8',
        batchId: 'sample_batch_2',
        stage: FermentationStage.FINAL_PROOF,
        temperature: 30.0,
        recordedAt: new Date(now.getTime() - 1 * 60 * 60 * 1000).toISOString(),
        note: '醒发完成前记录'
      }
    ],
    notes: '全麦面包，麦香浓郁'
  });

  batches.push({
    id: 'sample_batch_3',
    batchNumber: '20240510-003',
    doughType: DoughType.SOURDOUGH,
    weight: 1800,
    targetTemperature: 25,
    createdAt: new Date(now.getTime() - 3 * 60 * 60 * 1000).toISOString(),
    currentStage: FermentationStage.BULK_FERMENT,
    stageTransitions: [
      {
        fromStage: null,
        toStage: FermentationStage.PRE_FERMENT,
        timestamp: new Date(now.getTime() - 3 * 60 * 60 * 1000).toISOString(),
        note: '酸面团预发酵'
      },
      {
        fromStage: FermentationStage.PRE_FERMENT,
        toStage: FermentationStage.BULK_FERMENT,
        timestamp: new Date(now.getTime() - 1.5 * 60 * 60 * 1000).toISOString(),
        note: '预发酵完成，酸味明显'
      }
    ],
    temperatureRecords: [
      {
        id: 'temp_9',
        batchId: 'sample_batch_3',
        stage: FermentationStage.PRE_FERMENT,
        temperature: 24.5,
        recordedAt: new Date(now.getTime() - 2.5 * 60 * 60 * 1000).toISOString(),
        note: '正常'
      },
      {
        id: 'temp_10',
        batchId: 'sample_batch_3',
        stage: FermentationStage.BULK_FERMENT,
        temperature: 25.2,
        recordedAt: new Date(now.getTime() - 1 * 60 * 60 * 1000).toISOString(),
        note: '温度稳定'
      }
    ],
    notes: '传统酸面团，用于乡村面包'
  });

  batches.push({
    id: 'sample_batch_4',
    batchNumber: '20240510-004',
    doughType: DoughType.MULTIGRAIN,
    weight: 1200,
    targetTemperature: 24,
    createdAt: new Date(now.getTime() - 30 * 60 * 1000).toISOString(),
    currentStage: FermentationStage.PRE_FERMENT,
    stageTransitions: [
      {
        fromStage: null,
        toStage: FermentationStage.PRE_FERMENT,
        timestamp: new Date(now.getTime() - 30 * 60 * 1000).toISOString(),
        note: '多谷物面团预发酵，添加燕麦和亚麻籽'
      }
    ],
    temperatureRecords: [],
    notes: '健康多谷物面包'
  });

  return batches;
};

export const sampleDataSummary = {
  totalBatches: 4,
  stages: {
    [FermentationStage.PRE_FERMENT]: 1,
    [FermentationStage.BULK_FERMENT]: 1,
    [FermentationStage.BENCH_REST]: 0,
    [FermentationStage.FINAL_PROOF]: 1,
    [FermentationStage.COMPLETED]: 1
  },
  doughTypes: {
    [DoughType.WHITE]: 1,
    [DoughType.WHOLE_WHEAT]: 1,
    [DoughType.SOURDOUGH]: 1,
    [DoughType.MULTIGRAIN]: 1,
    [DoughType.RYE]: 0
  }
};
