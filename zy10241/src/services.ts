import { v4 as uuidv4 } from 'uuid';
import { Storage } from './storage';
import { BottleStatus, SampleBottle, FlowRecord, ColdStorageRecord, SamplingTask } from './types';

const STATUS_TRANSITIONS: Record<BottleStatus, BottleStatus[]> = {
  [BottleStatus.CREATED]: [BottleStatus.BINDED],
  [BottleStatus.BINDED]: [BottleStatus.SAMPLED],
  [BottleStatus.SAMPLED]: [BottleStatus.COLD_STORED, BottleStatus.REJECTED],
  [BottleStatus.COLD_STORED]: [BottleStatus.TRANSFERRED, BottleStatus.REJECTED],
  [BottleStatus.TRANSFERRED]: [BottleStatus.RECEIVED, BottleStatus.REJECTED],
  [BottleStatus.RECEIVED]: [BottleStatus.TESTED, BottleStatus.REJECTED],
  [BottleStatus.TESTED]: [BottleStatus.RETURNED],
  [BottleStatus.RETURNED]: [],
  [BottleStatus.REJECTED]: []
};

export class BusinessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BusinessError';
  }
}

function validateTransition(from: BottleStatus, to: BottleStatus): boolean {
  const allowed = STATUS_TRANSITIONS[from] || [];
  return allowed.includes(to);
}

function getHoursDiff(start: string, end: string): number {
  const startDate = new Date(start);
  const endDate = new Date(end);
  return (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60);
}

function createFlowRecord(
  bottle: SampleBottle,
  toStatus: BottleStatus,
  handler: string | null,
  remark: string | null,
  isColdStored: boolean
): FlowRecord {
  return {
    id: uuidv4(),
    bottleId: bottle.id,
    bottleNo: bottle.bottleNo,
    fromStatus: bottle.status,
    toStatus,
    handler,
    remark,
    operationTime: new Date().toISOString(),
    isColdStored
  };
}

export class BottleService {
  static getBottleByNo(bottleNo: string): SampleBottle | undefined {
    return Storage.getBottles().find(b => b.bottleNo === bottleNo);
  }

  static getBottleById(id: string): SampleBottle | undefined {
    return Storage.getBottles().find(b => b.id === id);
  }

  static getAllBottles(): SampleBottle[] {
    return Storage.getBottles();
  }

  static getBottleFlowRecords(bottleId: string): FlowRecord[] {
    return Storage.getFlowRecords()
      .filter(r => r.bottleId === bottleId)
      .sort((a, b) => new Date(a.operationTime).getTime() - new Date(b.operationTime).getTime());
  }

  static bindToTask(bottleNo: string, taskId: string, handler: string): SampleBottle {
    const bottles = Storage.getBottles();
    const bottle = bottles.find(b => b.bottleNo === bottleNo);
    
    if (!bottle) {
      throw new BusinessError(`采样瓶 ${bottleNo} 不存在`);
    }

    if (bottle.taskId) {
      throw new BusinessError(`采样瓶 ${bottleNo} 已绑定到任务，不能重复绑定`);
    }

    if (bottle.status !== BottleStatus.CREATED) {
      throw new BusinessError(`采样瓶 ${bottleNo} 状态不是初始状态，不能绑定任务`);
    }

    const task = Storage.getTasks().find(t => t.id === taskId);
    if (!task) {
      throw new BusinessError(`任务 ${taskId} 不存在`);
    }

    const now = new Date().toISOString();
    const newStatus = BottleStatus.BINDED;
    
    const flowRecord = createFlowRecord(bottle, newStatus, handler, `绑定任务: ${task.taskNo}`, false);
    bottle.taskId = taskId;
    bottle.status = newStatus;
    bottle.currentHandler = handler;
    bottle.updatedAt = now;

    Storage.saveBottles(bottles);
    const records = Storage.getFlowRecords();
    records.push(flowRecord);
    Storage.saveFlowRecords(records);

    return bottle;
  }

  static sample(bottleNo: string, handler: string): SampleBottle {
    const bottles = Storage.getBottles();
    const bottle = bottles.find(b => b.bottleNo === bottleNo);
    
    if (!bottle) {
      throw new BusinessError(`采样瓶 ${bottleNo} 不存在`);
    }

    if (bottle.status !== BottleStatus.BINDED) {
      throw new BusinessError(`采样瓶 ${bottleNo} 状态不是已绑定，不能采样`);
    }

    const now = new Date().toISOString();
    const newStatus = BottleStatus.SAMPLED;
    
    const flowRecord = createFlowRecord(bottle, newStatus, handler, '完成采样', false);
    bottle.status = newStatus;
    bottle.currentHandler = handler;
    bottle.sampledAt = now;
    bottle.updatedAt = now;

    Storage.saveBottles(bottles);
    const records = Storage.getFlowRecords();
    records.push(flowRecord);
    Storage.saveFlowRecords(records);

    return bottle;
  }

  static coldStore(bottleNo: string, handler: string, temperature: number): SampleBottle {
    const bottles = Storage.getBottles();
    const bottle = bottles.find(b => b.bottleNo === bottleNo);
    
    if (!bottle) {
      throw new BusinessError(`采样瓶 ${bottleNo} 不存在`);
    }

    if (bottle.status !== BottleStatus.SAMPLED) {
      throw new BusinessError(`采样瓶 ${bottleNo} 状态不是已采样，不能冷藏`);
    }

    const now = new Date().toISOString();
    const newStatus = BottleStatus.COLD_STORED;
    
    const flowRecord = createFlowRecord(bottle, newStatus, handler, `开始冷藏，温度: ${temperature}°C`, true);
    bottle.status = newStatus;
    bottle.currentHandler = handler;
    bottle.coldStoredAt = now;
    bottle.updatedAt = now;

    const coldRecord: ColdStorageRecord = {
      id: uuidv4(),
      bottleId: bottle.id,
      startTime: now,
      endTime: null,
      temperature,
      handler
    };

    Storage.saveBottles(bottles);
    const flowRecords = Storage.getFlowRecords();
    flowRecords.push(flowRecord);
    Storage.saveFlowRecords(flowRecords);
    
    const coldRecords = Storage.getColdStorageRecords();
    coldRecords.push(coldRecord);
    Storage.saveColdStorageRecords(coldRecords);

    return bottle;
  }

  static transfer(bottleNo: string, handler: string): SampleBottle {
    const bottles = Storage.getBottles();
    const bottle = bottles.find(b => b.bottleNo === bottleNo);
    
    if (!bottle) {
      throw new BusinessError(`采样瓶 ${bottleNo} 不存在`);
    }

    if (bottle.status !== BottleStatus.COLD_STORED) {
      throw new BusinessError(`采样瓶 ${bottleNo} 状态不是已冷藏，不能交接`);
    }

    const now = new Date().toISOString();
    const newStatus = BottleStatus.TRANSFERRED;
    
    const flowRecord = createFlowRecord(bottle, newStatus, handler, '完成交接送检', true);
    bottle.status = newStatus;
    bottle.currentHandler = handler;
    bottle.updatedAt = now;

    Storage.saveBottles(bottles);
    const records = Storage.getFlowRecords();
    records.push(flowRecord);
    Storage.saveFlowRecords(records);

    return bottle;
  }

  static receive(bottleNo: string, handler: string): SampleBottle {
    const bottles = Storage.getBottles();
    const bottle = bottles.find(b => b.bottleNo === bottleNo);
    
    if (!bottle) {
      throw new BusinessError(`采样瓶 ${bottleNo} 不存在`);
    }

    if (bottle.status === BottleStatus.REJECTED || bottle.status === BottleStatus.RETURNED) {
      throw new BusinessError(`采样瓶 ${bottleNo} 已退样或已归还，不能接收`);
    }

    if (bottle.status !== BottleStatus.TRANSFERRED) {
      throw new BusinessError(`采样瓶 ${bottleNo} 状态不是已交接，不能接收`);
    }

    const now = new Date().toISOString();
    
    if (bottle.taskId && bottle.sampledAt) {
      const task = Storage.getTasks().find(t => t.id === bottle.taskId);
      if (task) {
        const hoursPassed = getHoursDiff(bottle.sampledAt, now);
        if (hoursPassed > task.deadlineHours) {
          throw new BusinessError(`采样瓶 ${bottleNo} 已超时，采样后 ${hoursPassed.toFixed(1)} 小时，限 ${task.deadlineHours} 小时内送检`);
        }
      }
    }

    const coldRecords = Storage.getColdStorageRecords().filter(c => c.bottleId === bottle.id);
    const hasValidColdStorage = coldRecords.some(c => c.startTime && (!c.endTime || new Date(c.endTime) > new Date(bottle.sampledAt!)));
    if (!hasValidColdStorage && !bottle.coldStoredAt) {
      throw new BusinessError(`采样瓶 ${bottleNo} 采样后未进行冷藏，不能接收`);
    }

    const newStatus = BottleStatus.RECEIVED;
    
    const flowRecord = createFlowRecord(bottle, newStatus, handler, '实验室接收', true);
    bottle.status = newStatus;
    bottle.currentHandler = handler;
    bottle.receivedAt = now;
    bottle.updatedAt = now;

    Storage.saveBottles(bottles);
    const records = Storage.getFlowRecords();
    records.push(flowRecord);
    Storage.saveFlowRecords(records);

    return bottle;
  }

  static reject(bottleNo: string, handler: string, reason: string): SampleBottle {
    const bottles = Storage.getBottles();
    const bottle = bottles.find(b => b.bottleNo === bottleNo);
    
    if (!bottle) {
      throw new BusinessError(`采样瓶 ${bottleNo} 不存在`);
    }

    if (bottle.status === BottleStatus.REJECTED || bottle.status === BottleStatus.RETURNED) {
      throw new BusinessError(`采样瓶 ${bottleNo} 已退样或已归还，不能重复退样`);
    }

    const now = new Date().toISOString();
    const newStatus = BottleStatus.REJECTED;
    
    const flowRecord = createFlowRecord(bottle, newStatus, handler, `退样原因: ${reason}`, false);
    bottle.status = newStatus;
    bottle.currentHandler = handler;
    bottle.rejectedAt = now;
    bottle.rejectReason = reason;
    bottle.updatedAt = now;

    Storage.saveBottles(bottles);
    const records = Storage.getFlowRecords();
    records.push(flowRecord);
    Storage.saveFlowRecords(records);

    return bottle;
  }

  static test(bottleNo: string, handler: string): SampleBottle {
    const bottles = Storage.getBottles();
    const bottle = bottles.find(b => b.bottleNo === bottleNo);
    
    if (!bottle) {
      throw new BusinessError(`采样瓶 ${bottleNo} 不存在`);
    }

    if (bottle.status !== BottleStatus.RECEIVED) {
      throw new BusinessError(`采样瓶 ${bottleNo} 状态不是已接收，不能检测`);
    }

    const now = new Date().toISOString();
    const newStatus = BottleStatus.TESTED;
    
    const flowRecord = createFlowRecord(bottle, newStatus, handler, '完成检测', true);
    bottle.status = newStatus;
    bottle.currentHandler = handler;
    bottle.updatedAt = now;

    Storage.saveBottles(bottles);
    const records = Storage.getFlowRecords();
    records.push(flowRecord);
    Storage.saveFlowRecords(records);

    return bottle;
  }

  static returnBottle(bottleNo: string, handler: string): SampleBottle {
    const bottles = Storage.getBottles();
    const bottle = bottles.find(b => b.bottleNo === bottleNo);
    
    if (!bottle) {
      throw new BusinessError(`采样瓶 ${bottleNo} 不存在`);
    }

    if (bottle.status !== BottleStatus.TESTED) {
      throw new BusinessError(`采样瓶 ${bottleNo} 状态不是已检测，不能归还`);
    }

    const now = new Date().toISOString();
    const newStatus = BottleStatus.RETURNED;
    
    const flowRecord = createFlowRecord(bottle, newStatus, handler, '归还采样瓶', false);
    bottle.status = newStatus;
    bottle.currentHandler = handler;
    bottle.updatedAt = now;

    Storage.saveBottles(bottles);
    const records = Storage.getFlowRecords();
    records.push(flowRecord);
    Storage.saveFlowRecords(records);

    return bottle;
  }

  static getBottleTrail(bottleNo: string): { bottle: SampleBottle; records: FlowRecord[]; task?: SamplingTask } {
    const bottle = this.getBottleByNo(bottleNo);
    if (!bottle) {
      throw new BusinessError(`采样瓶 ${bottleNo} 不存在`);
    }

    const records = this.getBottleFlowRecords(bottle.id);
    const task = bottle.taskId ? Storage.getTasks().find(t => t.id === bottle.taskId) : undefined;

    return { bottle, records, task };
  }
}

export class TaskService {
  static getAllTasks(): SamplingTask[] {
    return Storage.getTasks();
  }

  static getTaskById(id: string): SamplingTask | undefined {
    return Storage.getTasks().find(t => t.id === id);
  }

  static getTaskByNo(taskNo: string): SamplingTask | undefined {
    return Storage.getTasks().find(t => t.taskNo === taskNo);
  }
}
