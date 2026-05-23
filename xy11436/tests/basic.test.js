const { describe, it, beforeEach, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { Task, SourceEvidence, TASK_STATUS, SOURCE_TYPES } = require('../src/models/Task');
const { DataStore } = require('../src/models/DataStore');

const testDir = path.join(__dirname, 'test-data');

describe('核心数据模型测试', () => {
  it('应该创建任务并记录审计轨迹', () => {
    const evidence = new SourceEvidence(
      SOURCE_TYPES.ORDER_CALENDAR,
      'test.csv',
      2,
      'raw data',
      { roomNumber: '101' }
    );
    
    const task = new Task('101', '2026-05-23', '退房清洁', evidence, 'test_user');
    
    assert.equal(task.roomNumber, '101');
    assert.equal(task.status, TASK_STATUS.PENDING);
    assert.equal(task.sourceEvidences.length, 1);
    assert.equal(task.auditTrail.length, 1);
    assert.equal(task.auditTrail[0].operator, 'test_user');
  });

  it('应该添加来源证据并防止重复', () => {
    const evidence1 = new SourceEvidence(
      SOURCE_TYPES.ORDER_CALENDAR,
      'test.csv',
      2,
      'raw data',
      {}
    );
    
    const task = new Task('101', '2026-05-23', '退房清洁', evidence1, 'test');
    
    const evidence2 = new SourceEvidence(
      SOURCE_TYPES.CLEANING_GROUP,
      'group.txt',
      3,
      'group message',
      {}
    );
    task.addSourceEvidence(evidence2, 'test2');
    
    assert.equal(task.sourceEvidences.length, 2);
    assert.equal(task.auditTrail.length, 2);

    assert.throws(() => {
      task.addSourceEvidence(evidence1, 'test3');
    }, /Duplicate source/);
  });

  it('应该支持状态变更并记录审计轨迹', () => {
    const evidence = new SourceEvidence(SOURCE_TYPES.ORDER_CALENDAR, 'test.csv', 2, 'raw', {});
    const task = new Task('101', '2026-05-23', '退房清洁', evidence, 'test');
    
    task.updateStatus(TASK_STATUS.CONFIRMED, 'operator1', '手动确认');
    
    assert.equal(task.status, TASK_STATUS.CONFIRMED);
    assert.equal(task.auditTrail.length, 2);
    assert.ok(task.auditTrail[1].reason.includes('手动确认'));
  });

  it('应该支持人工改判且不覆盖原始证据', () => {
    const evidence = new SourceEvidence(SOURCE_TYPES.ORDER_CALENDAR, 'test.csv', 2, 'raw', {});
    const task = new Task('101', '2026-05-23', '退房清洁', evidence, 'test');
    
    task.manualOverride({ type: '续住清洁' }, 'manager', '客人实际续住');
    
    assert.ok(task.manualOverride);
    assert.equal(task.manualOverride.data.type, '续住清洁');
    assert.equal(task.manualOverride.reason, '客人实际续住');
    assert.equal(task.sourceEvidences.length, 1);
    assert.equal(task.sourceEvidences[0].rawContent, 'raw');
  });

  it('应该支持冻结防止修改', () => {
    const evidence = new SourceEvidence(SOURCE_TYPES.ORDER_CALENDAR, 'test.csv', 2, 'raw', {});
    const task = new Task('101', '2026-05-23', '退房清洁', evidence, 'test');
    
    task.freeze('export');
    
    assert.equal(task.isFrozen, true);
    assert.equal(task.status, TASK_STATUS.FROZEN);
    
    assert.throws(() => {
      task.updateStatus(TASK_STATUS.CONFIRMED, 'test', '尝试修改');
    }, /frozen/);
  });
});

describe('数据存储测试', () => {
  beforeEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true });
    }
  });

  after(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true });
    }
  });

  it('应该初始化数据存储', () => {
    const store = new DataStore(testDir);
    const data = store.load();
    
    assert.ok(data.tasks);
    assert.ok(data.importSessions);
    assert.equal(data.isFrozen, false);
  });

  it('应该添加任务并创建快照', () => {
    const store = new DataStore(testDir);
    const evidence = new SourceEvidence(SOURCE_TYPES.ORDER_CALENDAR, 'test.csv', 2, 'raw', {});
    const task = new Task('101', '2026-05-23', '退房清洁', evidence, 'test');
    
    store.addTask(task, 'test_user');
    
    const data = store.load();
    assert.equal(data.tasks.length, 1);
    
    const snapshots = store.listSnapshots();
    assert.ok(snapshots.length >= 1);
  });

  it('应该支持冻结全部数据', () => {
    const store = new DataStore(testDir);
    const evidence = new SourceEvidence(SOURCE_TYPES.ORDER_CALENDAR, 'test.csv', 2, 'raw', {});
    const task = new Task('101', '2026-05-23', '退房清洁', evidence, 'test');
    store.addTask(task, 'test');
    
    store.freezeAll('export_user');
    
    assert.equal(store.isFrozen(), true);
    
    assert.throws(() => {
      const evidence2 = new SourceEvidence(SOURCE_TYPES.GROUP, 't.txt', 3, 'raw2', {});
      const task2 = new Task('102', '2026-05-23', '清洁', evidence2, 'test');
      store.addTask(task2, 'test');
    }, /frozen/);
  });

  it('应该支持快照历史回滚对比', () => {
    const store = new DataStore(testDir);
    
    const evidence1 = new SourceEvidence(SOURCE_TYPES.ORDER_CALENDAR, 't1.csv', 2, 'raw1', {});
    const task1 = new Task('101', '2026-05-23', '退房清洁', evidence1, 'test');
    store.addTask(task1, 'user1');
    
    const snapshots1 = store.listSnapshots();
    assert.equal(snapshots1[0].taskCount, 1);
    
    const evidence2 = new SourceEvidence(SOURCE_TYPES.CLEANING_GROUP, 't2.txt', 3, 'raw2', {});
    const task2 = new Task('102', '2026-05-23', '清洁', evidence2, 'test');
    store.addTask(task2, 'user2');
    
    const snapshots2 = store.listSnapshots();
    assert.equal(snapshots2[0].taskCount, 2);
  });
});
