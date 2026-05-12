import { describe, it, expect, beforeEach } from 'vitest';
import { v4 as uuidv4 } from 'uuid';
import { store, resetStore } from '../store';
import {
  createTasksFromInspection,
  scheduleReview,
  completeReview,
  manuallyCutOffGas,
  restoreGas,
  getMerchantCurrentStatus,
  getTaskSuggestion,
  RECTIFICATION_DAYS,
  GAS_CUTOFF_AFTER_FAILED_REVIEWS,
} from '../services/rectificationService';
import { Inspection, Merchant } from '../types';

function createTestMerchant(): Merchant {
  return {
    id: uuidv4(),
    name: '测试商户',
    address: '测试地址',
    contactPerson: '测试人',
    contactPhone: '123456789',
    businessType: '测试',
    gasSupplier: '测试燃气',
    accountNo: 'TEST-001',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    currentStatus: 'normal',
  };
}

function addDays(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
}

describe('整改复查周期规则', () => {
  it('软管问题整改周期应为3天', () => {
    expect(RECTIFICATION_DAYS.hose).toBe(3);
  });

  it('报警器问题整改周期应为5天', () => {
    expect(RECTIFICATION_DAYS.alarm).toBe(5);
  });

  it('阀门问题整改周期应为7天', () => {
    expect(RECTIFICATION_DAYS.valve).toBe(7);
  });

  it('连续2次复查不通过应自动停气', () => {
    expect(GAS_CUTOFF_AFTER_FAILED_REVIEWS).toBe(2);
  });
});

describe('整改任务创建', () => {
  beforeEach(() => {
    resetStore();
  });

  it('安检发现多个问题应创建对应数量的整改任务', () => {
    const merchant = createTestMerchant();
    store.merchants.push(merchant);

    const inspection: Inspection = {
      id: uuidv4(),
      merchantId: merchant.id,
      inspector: '测试安检员',
      inspectionDate: new Date().toISOString().split('T')[0],
      status: 'has_problem',
      remarks: '',
      createdAt: new Date().toISOString(),
      problems: [
        {
          id: uuidv4(),
          inspectionId: '',
          problemType: 'hose',
          description: '软管问题1',
          severity: 'critical',
          rectificationDays: 3,
          createdAt: new Date().toISOString(),
        },
        {
          id: uuidv4(),
          inspectionId: '',
          problemType: 'alarm',
          description: '报警器问题1',
          severity: 'major',
          rectificationDays: 5,
          createdAt: new Date().toISOString(),
        },
      ],
    };

    const tasks = createTasksFromInspection(inspection);

    expect(tasks.length).toBe(2);
    expect(store.rectificationTasks.length).toBe(2);
    expect(tasks[0].status).toBe('created');
    expect(tasks[0].deadline).toBeDefined();
  });

  it('软管问题整改期限应按安检日期加3天计算', () => {
    const merchant = createTestMerchant();
    store.merchants.push(merchant);

    const inspectionDate = '2024-01-10';
    const inspection: Inspection = {
      id: uuidv4(),
      merchantId: merchant.id,
      inspector: '测试',
      inspectionDate,
      status: 'has_problem',
      remarks: '',
      createdAt: new Date().toISOString(),
      problems: [
        {
          id: uuidv4(),
          inspectionId: '',
          problemType: 'hose',
          description: '软管测试',
          severity: 'critical',
          rectificationDays: 3,
          createdAt: new Date().toISOString(),
        },
      ],
    };

    const tasks = createTasksFromInspection(inspection);
    expect(tasks[0].deadline).toBe('2024-01-13');
  });

  it('创建任务时应记录状态变更历史', () => {
    const merchant = createTestMerchant();
    store.merchants.push(merchant);

    const inspection: Inspection = {
      id: uuidv4(),
      merchantId: merchant.id,
      inspectionDate: new Date().toISOString().split('T')[0],
      inspector: '测试',
      status: 'has_problem',
      remarks: '',
      createdAt: new Date().toISOString(),
      problems: [
        {
          id: uuidv4(),
          inspectionId: '',
          problemType: 'hose',
          description: '测试',
          severity: 'critical',
          rectificationDays: 3,
          createdAt: new Date().toISOString(),
        },
      ],
    };

    const tasks = createTasksFromInspection(inspection);

    const history = store.statusChanges.filter(sc => sc.taskId === tasks[0].id);
    expect(history.length).toBeGreaterThan(0);
    expect(history[0].toStatus).toBe('created');
  });
});

describe('复查预约与完成', () => {
  beforeEach(() => {
    resetStore();
  });

  it('预约复查应更新状态为scheduled_review', () => {
    const merchant = createTestMerchant();
    store.merchants.push(merchant);

    const inspection: Inspection = {
      id: uuidv4(),
      merchantId: merchant.id,
      inspector: '测试',
      inspectionDate: new Date().toISOString().split('T')[0],
      status: 'has_problem',
      remarks: '',
      createdAt: new Date().toISOString(),
      problems: [
        {
          id: uuidv4(),
          inspectionId: '',
          problemType: 'hose',
          description: '测试',
          severity: 'critical',
          rectificationDays: 3,
          createdAt: new Date().toISOString(),
        },
      ],
    };

    const tasks = createTasksFromInspection(inspection);
    const taskId = tasks[0].id;

    const updatedTask = scheduleReview(taskId, addDays(1), '测试员-张三');

    expect(updatedTask?.status).toBe('scheduled_review');
    expect(updatedTask?.reviewScheduledDate).toBeDefined();
    expect(updatedTask?.handler).toBe('测试员-张三');
  });

  it('复查通过应完成任务', () => {
    const merchant = createTestMerchant();
    store.merchants.push(merchant);

    const inspection: Inspection = {
      id: uuidv4(),
      merchantId: merchant.id,
      inspectionDate: new Date().toISOString().split('T')[0],
      inspector: '测试',
      status: 'has_problem',
      remarks: '',
      createdAt: new Date().toISOString(),
      problems: [
        {
          id: uuidv4(),
          inspectionId: '',
          problemType: 'hose',
          description: '测试',
          severity: 'critical',
          rectificationDays: 3,
          createdAt: new Date().toISOString(),
        },
      ],
    };

    const tasks = createTasksFromInspection(inspection);
    const taskId = tasks[0].id;

    scheduleReview(taskId, addDays(1), '测试员');
    const result = completeReview(taskId, 'passed', '测试员');

    expect(result?.status).toBe('completed');
    expect(result?.reviewResult).toBe('passed');
    expect(result?.completedDate).toBeDefined();
  });

  it('第一次复查不通过状态应为review_failed', () => {
    const merchant = createTestMerchant();
    store.merchants.push(merchant);

    const inspection: Inspection = {
      id: uuidv4(),
      merchantId: merchant.id,
      inspectionDate: new Date().toISOString().split('T')[0],
      inspector: '测试',
      status: 'has_problem',
      remarks: '',
      createdAt: new Date().toISOString(),
      problems: [
        {
          id: uuidv4(),
          inspectionId: '',
          problemType: 'hose',
          description: '测试',
          severity: 'critical',
          rectificationDays: 3,
          createdAt: new Date().toISOString(),
        },
      ],
    };

    const tasks = createTasksFromInspection(inspection);
    const taskId = tasks[0].id;

    scheduleReview(taskId, addDays(1), '测试员');
    const result = completeReview(taskId, 'failed', '测试员');

    expect(result?.status).toBe('review_failed');
  });

  it('连续2次复查不通过应执行停气', () => {
    const merchant = createTestMerchant();
    store.merchants.push(merchant);

    const inspection: Inspection = {
      id: uuidv4(),
      merchantId: merchant.id,
      inspectionDate: new Date().toISOString().split('T')[0],
      inspector: '测试',
      status: 'has_problem',
      remarks: '',
      createdAt: new Date().toISOString(),
      problems: [
        {
          id: uuidv4(),
          inspectionId: '',
          problemType: 'hose',
          description: '测试',
          severity: 'critical',
          rectificationDays: 3,
          createdAt: new Date().toISOString(),
        },
      ],
    };

    const tasks = createTasksFromInspection(inspection);
    const taskId = tasks[0].id;

    scheduleReview(taskId, addDays(1), '测试员');
    completeReview(taskId, 'failed', '测试员');

    scheduleReview(taskId, addDays(1), '测试员');
    const result = completeReview(taskId, 'failed', '测试员');

    expect(result?.status).toBe('gas_cut_off');
    expect(result?.gasCutOffDate).toBeDefined();
  });

  it('非scheduled_review状态不能完成复查', () => {
    const merchant = createTestMerchant();
    store.merchants.push(merchant);

    const inspection: Inspection = {
      id: uuidv4(),
      merchantId: merchant.id,
      inspectionDate: new Date().toISOString().split('T')[0],
      inspector: '测试',
      status: 'has_problem',
      remarks: '',
      createdAt: new Date().toISOString(),
      problems: [
        {
          id: uuidv4(),
          inspectionId: '',
          problemType: 'hose',
          description: '测试',
          severity: 'critical',
          rectificationDays: 3,
          createdAt: new Date().toISOString(),
        },
      ],
    };

    const tasks = createTasksFromInspection(inspection);
    const taskId = tasks[0].id;

    const result = completeReview(taskId, 'passed', '测试员');
    expect(result).toBeNull();
  });
});

describe('停气与恢复供气', () => {
  beforeEach(() => {
    resetStore();
  });

  it('手动停气应设置状态为gas_cut_off', () => {
    const merchant = createTestMerchant();
    store.merchants.push(merchant);

    const inspection: Inspection = {
      id: uuidv4(),
      merchantId: merchant.id,
      inspectionDate: new Date().toISOString().split('T')[0],
      inspector: '测试',
      status: 'has_problem',
      remarks: '',
      createdAt: new Date().toISOString(),
      problems: [
        {
          id: uuidv4(),
          inspectionId: '',
          problemType: 'hose',
          description: '测试',
          severity: 'critical',
          rectificationDays: 3,
          createdAt: new Date().toISOString(),
        },
      ],
    };

    const tasks = createTasksFromInspection(inspection);
    const taskId = tasks[0].id;

    const result = manuallyCutOffGas(taskId, '管理员', '逾期严重');

    expect(result?.status).toBe('gas_cut_off');
    expect(result?.gasCutOffDate).toBeDefined();
  });

  it('恢复供气应切换到scheduled_review状态', () => {
    const merchant = createTestMerchant();
    store.merchants.push(merchant);

    const inspection: Inspection = {
      id: uuidv4(),
      merchantId: merchant.id,
      inspectionDate: new Date().toISOString().split('T')[0],
      inspector: '测试',
      status: 'has_problem',
      remarks: '',
      createdAt: new Date().toISOString(),
      problems: [
        {
          id: uuidv4(),
          inspectionId: '',
          problemType: 'hose',
          description: '测试',
          severity: 'critical',
          rectificationDays: 3,
          createdAt: new Date().toISOString(),
        },
      ],
    };

    const tasks = createTasksFromInspection(inspection);
    const taskId = tasks[0].id;

    manuallyCutOffGas(taskId, '管理员', '逾期严重');
    const result = restoreGas(taskId, '管理员');

    expect(result?.status).toBe('scheduled_review');
  });

  it('非停气状态不能恢复供气', () => {
    const merchant = createTestMerchant();
    store.merchants.push(merchant);

    const inspection: Inspection = {
      id: uuidv4(),
      merchantId: merchant.id,
      inspectionDate: new Date().toISOString().split('T')[0],
      inspector: '测试',
      status: 'has_problem',
      remarks: '',
      createdAt: new Date().toISOString(),
      problems: [
        {
          id: uuidv4(),
          inspectionId: '',
          problemType: 'hose',
          description: '测试',
          severity: 'critical',
          rectificationDays: 3,
          createdAt: new Date().toISOString(),
        },
      ],
    };

    const tasks = createTasksFromInspection(inspection);
    const taskId = tasks[0].id;

    const result = restoreGas(taskId, '管理员');
    expect(result).toBeNull();
  });
});

describe('商户状态计算', () => {
  beforeEach(() => {
    resetStore();
  });

  it('无整改任务商户状态应为normal', () => {
    const merchant = createTestMerchant();
    store.merchants.push(merchant);

    const status = getMerchantCurrentStatus(merchant.id);
    expect(status).toBe('normal');
  });

  it('有未完成整改任务商户状态应为warning', () => {
    const merchant = createTestMerchant();
    store.merchants.push(merchant);

    const inspection: Inspection = {
      id: uuidv4(),
      merchantId: merchant.id,
      inspectionDate: new Date().toISOString().split('T')[0],
      inspector: '测试',
      status: 'has_problem',
      remarks: '',
      createdAt: new Date().toISOString(),
      problems: [
        {
          id: uuidv4(),
          inspectionId: '',
          problemType: 'hose',
          description: '测试',
          severity: 'critical',
          rectificationDays: 3,
          createdAt: new Date().toISOString(),
        },
      ],
    };

    createTasksFromInspection(inspection);

    const status = getMerchantCurrentStatus(merchant.id);
    expect(status).toBe('warning');
  });

  it('有停气任务商户状态应为gas_cut_off', () => {
    const merchant = createTestMerchant();
    store.merchants.push(merchant);

    const inspection: Inspection = {
      id: uuidv4(),
      merchantId: merchant.id,
      inspectionDate: new Date().toISOString().split('T')[0],
      inspector: '测试',
      status: 'has_problem',
      remarks: '',
      createdAt: new Date().toISOString(),
      problems: [
        {
          id: uuidv4(),
          inspectionId: '',
          problemType: 'hose',
          description: '测试',
          severity: 'critical',
          rectificationDays: 3,
          createdAt: new Date().toISOString(),
        },
      ],
    };

    const tasks = createTasksFromInspection(inspection);
    manuallyCutOffGas(tasks[0].id, '管理员', '测试');

    const status = getMerchantCurrentStatus(merchant.id);
    expect(status).toBe('gas_cut_off');
  });
});

describe('处理建议生成', () => {
  beforeEach(() => {
    resetStore();
  });

  it('已完成任务应返回低优先级建议', () => {
    const task: any = {
      id: uuidv4(),
      status: 'completed',
      deadline: new Date().toISOString().split('T')[0],
    };

    const suggestion = getTaskSuggestion(task);
    expect(suggestion.priority).toBe('low');
  });

  it('停气任务应返回紧急优先级', () => {
    const task: any = {
      id: uuidv4(),
      status: 'gas_cut_off',
      deadline: new Date().toISOString().split('T')[0],
    };

    const suggestion = getTaskSuggestion(task);
    expect(suggestion.priority).toBe('urgent');
  });
});
