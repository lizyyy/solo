import { v4 as uuidv4 } from 'uuid';
import { Storage } from './storage';
import { BottleStatus, SamplingTask, SampleBottle } from './types';

export function generateSeedData() {
  const now = new Date().toISOString();
  
  const tasks: SamplingTask[] = [
    {
      id: uuidv4(),
      taskNo: 'TASK-2024-001',
      samplingPoint: '城东污水处理厂进水口',
      plannedDate: '2024-05-12',
      deadlineHours: 24,
      createdAt: now
    },
    {
      id: uuidv4(),
      taskNo: 'TASK-2024-002',
      samplingPoint: '长江取水口A点',
      plannedDate: '2024-05-12',
      deadlineHours: 12,
      createdAt: now
    },
    {
      id: uuidv4(),
      taskNo: 'TASK-2024-003',
      samplingPoint: '工业园区排水口B',
      plannedDate: '2024-05-13',
      deadlineHours: 24,
      createdAt: now
    }
  ];

  const bottles: SampleBottle[] = [
    {
      id: uuidv4(),
      bottleNo: 'BOT-001',
      taskId: null,
      status: BottleStatus.CREATED,
      currentHandler: null,
      sampledAt: null,
      coldStoredAt: null,
      receivedAt: null,
      rejectedAt: null,
      rejectReason: null,
      createdAt: now,
      updatedAt: now
    },
    {
      id: uuidv4(),
      bottleNo: 'BOT-002',
      taskId: null,
      status: BottleStatus.CREATED,
      currentHandler: null,
      sampledAt: null,
      coldStoredAt: null,
      receivedAt: null,
      rejectedAt: null,
      rejectReason: null,
      createdAt: now,
      updatedAt: now
    },
    {
      id: uuidv4(),
      bottleNo: 'BOT-003',
      taskId: null,
      status: BottleStatus.CREATED,
      currentHandler: null,
      sampledAt: null,
      coldStoredAt: null,
      receivedAt: null,
      rejectedAt: null,
      rejectReason: null,
      createdAt: now,
      updatedAt: now
    },
    {
      id: uuidv4(),
      bottleNo: 'BOT-004',
      taskId: null,
      status: BottleStatus.CREATED,
      currentHandler: null,
      sampledAt: null,
      coldStoredAt: null,
      receivedAt: null,
      rejectedAt: null,
      rejectReason: null,
      createdAt: now,
      updatedAt: now
    },
    {
      id: uuidv4(),
      bottleNo: 'BOT-005',
      taskId: null,
      status: BottleStatus.CREATED,
      currentHandler: null,
      sampledAt: null,
      coldStoredAt: null,
      receivedAt: null,
      rejectedAt: null,
      rejectReason: null,
      createdAt: now,
      updatedAt: now
    }
  ];

  return { tasks, bottles };
}

export function loadSeedData() {
  const { tasks, bottles } = generateSeedData();
  Storage.clearAll();
  Storage.saveTasks(tasks);
  Storage.saveBottles(bottles);
  console.log('种子数据加载完成！');
  console.log(`采样任务: ${tasks.length} 个`);
  console.log(`采样瓶: ${bottles.length} 个`);
}

if (require.main === module) {
  loadSeedData();
}
