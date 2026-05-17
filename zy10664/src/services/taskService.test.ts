import { taskService } from './taskService';
import { store } from '../store';
import { TaskStatus, AuditAction } from '../types';

describe('TaskService - 完整流转测试', () => {
  beforeEach(() => {
    store.clearAll();
  });

  test('完整任务生命周期：创建 -> 失败熔断 -> 申请恢复 -> 标记条件满足 -> 审核通过 -> 恢复完成', () => {
    const createResult = taskService.createTask({
      taskName: '数据同步任务',
      taskCode: 'DATA_SYNC_001',
      schedulerName: 'Scheduler-A'
    });
    expect(createResult.success).toBe(true);
    expect(createResult.data?.status).toBe(TaskStatus.RUNNING);
    const taskId = createResult.data!.id;

    for (let i = 0; i < 3; i++) {
      const failResult = taskService.recordFailure(taskId, {
        errorMessage: `数据库连接失败 #${i + 1}`,
        errorStack: 'Error: Connection refused',
        retryCount: i
      });
      expect(failResult.success).toBe(true);
    }

    const taskAfterFuse = store.getTask(taskId)!;
    expect(taskAfterFuse.status).toBe(TaskStatus.FUSED);
    expect(taskAfterFuse.failureCount).toBe(3);
    expect(taskAfterFuse.fuseReason).toContain('触发熔断');
    expect(taskAfterFuse.hasQueuedRetry).toBe(true);

    const applyResult = taskService.applyRecovery(taskId, {
      applicant: '运维人员-张三',
      recoveryRemark: '数据库已修复，申请恢复任务',
      recoveryConditions: [
        { type: 'FIX_ERROR', description: '修复数据库连接问题' },
        { type: 'DATA_CLEAN', description: '清理异常数据' }
      ]
    });
    expect(applyResult.success).toBe(true);
    expect(applyResult.data?.status).toBe(TaskStatus.RECOVERY_APPLY);

    const conditions = store.getRecoveryConditions(taskId);
    expect(conditions.length).toBe(2);
    
    for (const condition of conditions) {
      const meetResult = taskService.meetRecoveryCondition(taskId, condition.id, '运维人员-李四');
      expect(meetResult.success).toBe(true);
    }

    const auditResult = taskService.auditRecovery(taskId, {
      auditor: '审核主管-王五',
      approved: true,
      auditRemark: '条件已满足，同意恢复'
    });
    expect(auditResult.success).toBe(true);
    expect(auditResult.data?.status).toBe(TaskStatus.RECOVERED);
    expect(auditResult.data?.failureCount).toBe(0);

    const detailResult = taskService.getTaskDetail(taskId);
    expect(detailResult.success).toBe(true);
    expect(detailResult.data?.auditHistories.length).toBeGreaterThan(0);
    
    const auditActions = detailResult.data?.auditHistories.map(h => h.action);
    expect(auditActions).toContain(AuditAction.CREATE);
    expect(auditActions).toContain(AuditAction.FUSE);
    expect(auditActions).toContain(AuditAction.APPLY_RECOVERY);
    expect(auditActions).toContain(AuditAction.APPROVE_RECOVERY);

    const listResult = taskService.listTasks();
    expect(listResult.data.list.length).toBe(1);
    expect(listResult.data.list[0].id).toBe(taskId);

    const exportResult = taskService.exportTasks();
    expect(exportResult.data.length).toBe(1);
  });

  test('撤回恢复申请流程', () => {
    const createResult = taskService.createTask({
      taskName: '报表生成任务',
      taskCode: 'REPORT_001',
      schedulerName: 'Scheduler-B'
    });
    const taskId = createResult.data!.id;

    for (let i = 0; i < 3; i++) {
      taskService.recordFailure(taskId, {
        errorMessage: '内存溢出',
        errorStack: 'OutOfMemoryError',
        retryCount: i
      });
    }

    const applyResult = taskService.applyRecovery(taskId, {
      applicant: '开发人员-赵六',
      recoveryRemark: '内存已扩容',
      recoveryConditions: [
        { type: 'FIX_ERROR', description: 'JVM内存扩容' }
      ]
    });
    expect(applyResult.data?.status).toBe(TaskStatus.RECOVERY_APPLY);

    const withdrawResult = taskService.withdraw(taskId, {
      operator: '开发人员-赵六',
      reason: '发现还有其他问题未修复，撤回申请'
    });
    expect(withdrawResult.success).toBe(true);
    expect(withdrawResult.data?.status).toBe(TaskStatus.FUSED);

    const detailResult = taskService.getTaskDetail(taskId);
    const hasWithdraw = detailResult.data?.auditHistories.some(h => h.action === AuditAction.WITHDRAW);
    expect(hasWithdraw).toBe(true);
  });

  test('人工备注处理队列中的重试记录', () => {
    const createResult = taskService.createTask({
      taskName: '消息推送任务',
      taskCode: 'PUSH_001',
      schedulerName: 'Scheduler-C'
    });
    const taskId = createResult.data!.id;

    for (let i = 0; i < 2; i++) {
      taskService.recordFailure(taskId, {
        errorMessage: '第三方服务超时',
        errorStack: 'TimeoutError',
        retryCount: i
      });
    }

    let task = store.getTask(taskId)!;
    expect(task.hasQueuedRetry).toBe(true);
    
    const failureRecords = store.getFailureRecords(taskId);
    const queuedCount = failureRecords.filter(r => r.isInQueue && !r.isProcessed).length;
    expect(queuedCount).toBe(2);

    const remarkResult = taskService.addManualRemark(taskId, {
      operator: '运维人员-孙七',
      remark: '第三方服务已恢复，手动标记已处理，继续推进流程'
    });
    expect(remarkResult.success).toBe(true);

    task = store.getTask(taskId)!;
    expect(task.hasQueuedRetry).toBe(false);
    expect(task.manualRemark).toBe('第三方服务已恢复，手动标记已处理，继续推进流程');

    const recordsAfter = store.getFailureRecords(taskId);
    const allProcessed = recordsAfter.every(r => r.isProcessed);
    expect(allProcessed).toBe(true);
  });
});

describe('TaskService - 冲突记录测试', () => {
  beforeEach(() => {
    store.clearAll();
  });

  test('任务编码唯一性验证', () => {
    const result1 = taskService.createTask({
      taskName: '任务1',
      taskCode: 'DUPLICATE_001',
      schedulerName: 'Scheduler-A'
    });
    expect(result1.success).toBe(true);

    const result2 = taskService.createTask({
      taskName: '任务2',
      taskCode: 'DUPLICATE_001',
      schedulerName: 'Scheduler-B'
    });
    expect(result2.success).toBe(false);
    expect(result2.errors).toBeDefined();
    expect(result2.errors![0].field).toBe('taskCode');
    expect(result2.errors![0].rule).toBe('UNIQUE');
  });

  test('状态流转冲突验证', () => {
    const createResult = taskService.createTask({
      taskName: '测试任务',
      taskCode: 'STATUS_TEST_001',
      schedulerName: 'Scheduler-A'
    });
    const taskId = createResult.data!.id;

    const applyResult = taskService.applyRecovery(taskId, {
      applicant: '测试人员',
      recoveryRemark: '测试申请',
      recoveryConditions: [{ type: 'OTHER', description: '测试' }]
    });
    expect(applyResult.success).toBe(false);
    expect(applyResult.errors![0].rule).toBe('STATUS');

    const auditResult = taskService.auditRecovery(taskId, {
      auditor: '审核人员',
      approved: true
    });
    expect(auditResult.success).toBe(false);

    const withdrawResult = taskService.withdraw(taskId, {
      operator: '测试人员',
      reason: '测试撤回'
    });
    expect(withdrawResult.success).toBe(false);
  });

  test('审核时恢复条件未满足的冲突', () => {
    const createResult = taskService.createTask({
      taskName: '条件测试任务',
      taskCode: 'CONDITION_TEST_001',
      schedulerName: 'Scheduler-A'
    });
    const taskId = createResult.data!.id;

    for (let i = 0; i < 3; i++) {
      taskService.recordFailure(taskId, {
        errorMessage: '测试失败',
        errorStack: 'TestError',
        retryCount: i
      });
    }

    taskService.applyRecovery(taskId, {
      applicant: '测试人员',
      recoveryRemark: '测试申请',
      recoveryConditions: [
        { type: 'FIX_ERROR', description: '条件1' },
        { type: 'FIX_ERROR', description: '条件2' }
      ]
    });

    const conditions = store.getRecoveryConditions(taskId);
    taskService.meetRecoveryCondition(taskId, conditions[0].id, '测试人员');

    const auditResult = taskService.auditRecovery(taskId, {
      auditor: '审核人员',
      approved: true
    });
    expect(auditResult.success).toBe(false);
    expect(auditResult.errors![0].rule).toBe('CONDITIONS');
  });
});

describe('TaskService - 导入坏行测试', () => {
  beforeEach(() => {
    store.clearAll();
  });

  test('导入包含正常数据、坏行、冲突数据', () => {
    const importData = [
      {
        taskName: '正常任务1',
        taskCode: 'IMPORT_001',
        schedulerName: 'Scheduler-A',
        failureCount: 0
      },
      {
        taskName: '',
        taskCode: 'IMPORT_002',
        schedulerName: 'Scheduler-B'
      },
      {
        taskName: '缺失编码任务',
        taskCode: '',
        schedulerName: 'Scheduler-C'
      },
      {
        taskName: '正常任务2',
        taskCode: 'IMPORT_003',
        schedulerName: 'Scheduler-D'
      },
      {
        taskName: '重复编码任务',
        taskCode: 'IMPORT_001',
        schedulerName: 'Scheduler-E'
      }
    ];

    const result = taskService.importTasks(importData);
    expect(result.data.success).toBe(2);
    expect(result.data.failed).toBe(2);
    expect(result.data.errors.length).toBe(2);
    expect(result.data.conflicts.length).toBe(1);

    expect(result.data.errors[0].row).toBe(2);
    expect(result.data.errors[1].row).toBe(3);
    expect(result.data.conflicts[0].row).toBe(5);
    expect(result.data.conflicts[0].message).toContain('已存在');

    const listResult = taskService.listTasks();
    expect(listResult.data.list.length).toBe(2);
  });

  test('空数据导入', () => {
    const result = taskService.importTasks([]);
    expect(result.data.success).toBe(0);
    expect(result.data.failed).toBe(0);
    expect(result.data.errors.length).toBe(0);
    expect(result.data.conflicts.length).toBe(0);
  });
});

describe('TaskService - 参数验证测试（失败时显示规则）', () => {
  beforeEach(() => {
    store.clearAll();
  });

  test('创建任务时参数验证失败显示具体规则', () => {
    const result = taskService.createTask({
      taskName: '',
      taskCode: 'invalid@code',
      schedulerName: ''
    });
    expect(result.success).toBe(false);
    expect(result.errors!.length).toBe(3);

    const rules = result.errors!.map(e => e.rule);
    expect(rules).toContain('REQUIRED');
    expect(rules).toContain('PATTERN');
  });

  test('申请恢复时参数验证失败显示具体规则', () => {
    const createResult = taskService.createTask({
      taskName: '测试任务',
      taskCode: 'VALIDATE_001',
      schedulerName: 'Scheduler-A'
    });
    const taskId = createResult.data!.id;

    for (let i = 0; i < 3; i++) {
      taskService.recordFailure(taskId, {
        errorMessage: '测试失败',
        errorStack: 'TestError',
        retryCount: i
      });
    }

    const result = taskService.applyRecovery(taskId, {
      applicant: '',
      recoveryRemark: '',
      recoveryConditions: []
    });
    expect(result.success).toBe(false);
    expect(result.errors!.length).toBeGreaterThan(0);

    const rules = result.errors!.map(e => e.rule);
    expect(rules).toContain('REQUIRED');
    expect(rules).toContain('MIN_LENGTH');
  });
});

describe('TaskService - 列表查询和筛选测试', () => {
  beforeEach(() => {
    store.clearAll();
  });

  test('按状态和调度器筛选任务', () => {
    taskService.createTask({
      taskName: '任务1',
      taskCode: 'FILTER_001',
      schedulerName: 'Scheduler-A'
    });
    
    const task2 = taskService.createTask({
      taskName: '任务2',
      taskCode: 'FILTER_002',
      schedulerName: 'Scheduler-B'
    });
    
    for (let i = 0; i < 3; i++) {
      taskService.recordFailure(task2.data!.id, {
        errorMessage: '测试失败',
        errorStack: 'TestError',
        retryCount: i
      });
    }

    const allResult = taskService.listTasks();
    expect(allResult.data.total).toBe(2);

    const fusedResult = taskService.listTasks({ status: TaskStatus.FUSED });
    expect(fusedResult.data.total).toBe(1);
    expect(fusedResult.data.list[0].taskCode).toBe('FILTER_002');

    const schedulerAResult = taskService.listTasks({ schedulerName: 'Scheduler-A' });
    expect(schedulerAResult.data.total).toBe(1);
    expect(schedulerAResult.data.list[0].schedulerName).toBe('Scheduler-A');
  });
});
