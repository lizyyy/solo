import { ExecutionLogger } from '../src/logger';
import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('ExecutionLogger', () => {
  it('应该正确初始化', () => {
    const logger = new ExecutionLogger();
    assert.strictEqual(logger.getLogs().length, 0);
  });

  it('应该正确记录成功日志', () => {
    const logger = new ExecutionLogger();
    const entry = logger.success('test-action', '测试成功');

    assert.strictEqual(logger.getLogs().length, 1);
    assert.strictEqual(entry.success, true);
    assert.strictEqual(entry.action, 'test-action');
    assert.strictEqual(entry.message, '测试成功');
  });

  it('应该正确记录错误日志', () => {
    const logger = new ExecutionLogger();
    const entry = logger.error('test-action', '测试错误');

    assert.strictEqual(logger.getLogs().length, 1);
    assert.strictEqual(entry.success, false);
    assert.strictEqual(entry.action, 'test-action');
    assert.strictEqual(entry.message, '测试错误');
  });

  it('应该正确记录通用日志', () => {
    const logger = new ExecutionLogger();
    const details = { key: 'value', num: 123 };
    const entry = logger.log('custom-action', true, '自定义消息', details);

    assert.strictEqual(logger.getLogs().length, 1);
    assert.strictEqual(entry.success, true);
    assert.strictEqual(entry.action, 'custom-action');
    assert.strictEqual(entry.message, '自定义消息');
    assert.deepStrictEqual(entry.details, details);
  });

  it('应该正确过滤错误日志', () => {
    const logger = new ExecutionLogger();
    logger.success('action-1', '成功1');
    logger.error('action-2', '错误1');
    logger.success('action-3', '成功2');
    logger.error('action-4', '错误2');

    const errors = logger.getErrors();
    assert.strictEqual(errors.length, 2);
    assert.strictEqual(errors.every(e => !e.success), true);
  });

  it('应该正确过滤成功日志', () => {
    const logger = new ExecutionLogger();
    logger.success('action-1', '成功1');
    logger.error('action-2', '错误1');
    logger.success('action-3', '成功2');
    logger.error('action-4', '错误2');

    const successes = logger.getSuccesses();
    assert.strictEqual(successes.length, 2);
    assert.strictEqual(successes.every(e => e.success), true);
  });

  it('应该正确按动作过滤日志', () => {
    const logger = new ExecutionLogger();
    logger.success('add-event', '添加事件1');
    logger.error('add-event', '添加事件失败');
    logger.success('search', '搜索成功');

    const addEventLogs = logger.getByAction('add-event');
    assert.strictEqual(addEventLogs.length, 2);
    assert.strictEqual(addEventLogs.every(e => e.action === 'add-event'), true);
  });

  it('应该正确获取最近日志', () => {
    const logger = new ExecutionLogger();
    for (let i = 0; i < 20; i++) {
      logger.success(`action-${i}`, `消息-${i}`);
    }

    const recent = logger.getRecent(5);
    assert.strictEqual(recent.length, 5);
    assert.strictEqual(recent[0].action, 'action-15');
    assert.strictEqual(recent[4].action, 'action-19');
  });

  it('应该正确统计日志', () => {
    const logger = new ExecutionLogger();
    logger.success('action-1', '成功1');
    logger.success('action-2', '成功2');
    logger.success('action-3', '成功3');
    logger.error('action-4', '错误1');

    const stats = logger.getStats();
    assert.strictEqual(stats.total, 4);
    assert.strictEqual(stats.success, 3);
    assert.strictEqual(stats.error, 1);
    assert.strictEqual(stats.successRate, 75);
  });

  it('应该正确处理空日志统计', () => {
    const logger = new ExecutionLogger();
    const stats = logger.getStats();
    assert.strictEqual(stats.total, 0);
    assert.strictEqual(stats.successRate, 0);
  });

  it('应该正确清除日志', () => {
    const logger = new ExecutionLogger();
    logger.success('action-1', '成功1');
    logger.success('action-2', '成功2');

    assert.strictEqual(logger.getLogs().length, 2);
    logger.clear();
    assert.strictEqual(logger.getLogs().length, 0);
  });

  it('应该正确限制最大日志数', () => {
    const maxLogs = 10;
    const logger = new ExecutionLogger(maxLogs);

    for (let i = 0; i < 20; i++) {
      logger.success(`action-${i}`, `消息-${i}`);
    }

    const logs = logger.getLogs();
    assert.strictEqual(logs.length, maxLogs);
    assert.strictEqual(logs[0].action, 'action-10');
  });

  it('应该正确导出 JSON 格式', () => {
    const logger = new ExecutionLogger();
    logger.success('action-1', '成功1');
    logger.error('action-2', '错误1', { code: 500 });

    const json = logger.export('json');
    const parsed = JSON.parse(json);

    assert.strictEqual(Array.isArray(parsed), true);
    assert.strictEqual(parsed.length, 2);
    assert.strictEqual(parsed[0].action, 'action-1');
    assert.strictEqual(parsed[1].success, false);
  });

  it('应该正确导出 CSV 格式', () => {
    const logger = new ExecutionLogger();
    logger.success('action-1', '成功1');
    logger.error('action-2', '错误1');

    const csv = logger.export('csv');
    const lines = csv.split('\n');

    assert.strictEqual(lines.length, 3);
    assert.strictEqual(lines[0].startsWith('timestamp,action'), true);
    assert.strictEqual(lines[1].includes('action-1'), true);
    assert.strictEqual(lines[2].includes('action-2'), true);
  });
});
