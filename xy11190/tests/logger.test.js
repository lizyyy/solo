import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import logger from '../src/logger.js';

describe('Logger', () => {
  beforeEach(() => {
    logger.errors = [];
    logger.warnings = [];
    logger.stats = {
      totalFiles: 0,
      processedFiles: 0,
      failedFiles: 0,
      totalRecords: 0,
      validRecords: 0,
      invalidRecords: 0
    };
    logger.verbose = false;
  });

  it('应正确初始化默认值', () => {
    assert.strictEqual(logger.verbose, false);
    assert.deepStrictEqual(logger.errors, []);
    assert.deepStrictEqual(logger.warnings, []);
  });

  it('应正确设置 verbose 模式', () => {
    logger.setVerbose(true);
    assert.strictEqual(logger.verbose, true);
    logger.setVerbose(false);
    assert.strictEqual(logger.verbose, false);
  });

  it('应记录错误信息', () => {
    logger.recordError('test.csv', 2, '测试错误', { test: 'data' });
    
    assert.strictEqual(logger.errors.length, 1);
    assert.strictEqual(logger.errors[0].file, 'test.csv');
    assert.strictEqual(logger.errors[0].lineNumber, 2);
    assert.strictEqual(logger.errors[0].reason, '测试错误');
    assert.strictEqual(logger.stats.invalidRecords, 1);
  });

  it('应记录警告信息', () => {
    logger.recordWarning('test.csv', 3, '测试警告', { test: 'data' });
    
    assert.strictEqual(logger.warnings.length, 1);
    assert.strictEqual(logger.warnings[0].file, 'test.csv');
    assert.strictEqual(logger.warnings[0].lineNumber, 3);
    assert.strictEqual(logger.warnings[0].reason, '测试警告');
  });

  it('应正确增加统计计数', () => {
    logger.incrementFiles(5);
    logger.incrementProcessedFiles();
    logger.incrementProcessedFiles();
    logger.incrementFailedFiles();
    logger.incrementRecords(10);
    logger.incrementValidRecords();
    logger.incrementValidRecords();
    logger.incrementValidRecords();
    
    assert.strictEqual(logger.stats.totalFiles, 5);
    assert.strictEqual(logger.stats.processedFiles, 2);
    assert.strictEqual(logger.stats.failedFiles, 1);
    assert.strictEqual(logger.stats.totalRecords, 10);
    assert.strictEqual(logger.stats.validRecords, 3);
  });

  it('应正确返回错误摘要', () => {
    logger.recordError('test.csv', 2, '测试错误');
    logger.recordWarning('test.csv', 3, '测试警告');
    logger.incrementFiles(1);
    logger.incrementProcessedFiles();
    
    const summary = logger.getErrorSummary();
    
    assert.strictEqual(summary.errors.length, 1);
    assert.strictEqual(summary.warnings.length, 1);
    assert.strictEqual(summary.stats.totalFiles, 1);
    assert.strictEqual(summary.stats.processedFiles, 1);
  });
});
