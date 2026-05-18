const { describe, it, before } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const ExportQueueAnalyzer = require('../src/analyzer');

describe('ExportQueueAnalyzer', () => {
  let analyzer;
  let normalRecords;
  let abnormalRecords;

  before(() => {
    analyzer = new ExportQueueAnalyzer({
      largeFileThreshold: 100 * 1024 * 1024,
      duplicateTimeWindow: 5 * 60 * 1000
    });

    normalRecords = JSON.parse(fs.readFileSync(path.join(__dirname, '../samples/normal.json'), 'utf-8'));
    abnormalRecords = JSON.parse(fs.readFileSync(path.join(__dirname, '../samples/abnormal.json'), 'utf-8'));
  });

  describe('基础功能测试', () => {
    it('应该正确初始化分析器', () => {
      assert.ok(analyzer);
      assert.strictEqual(typeof analyzer.analyze, 'function');
      assert.strictEqual(typeof analyzer.formatOutput, 'function');
    });

    it('应该能够验证记录的有效性', () => {
      const validRecords = analyzer.validateRecords(normalRecords);
      assert.strictEqual(validRecords.length, normalRecords.length);
    });

    it('应该过滤掉缺少必要字段的记录', () => {
      const invalidRecords = [
        { taskId: 'test' },
        { taskId: 'test', userId: 'U1' },
        { taskId: 'test', userId: 'U1', fileName: 'test.xlsx' }
      ];
      const validRecords = analyzer.validateRecords(invalidRecords);
      assert.strictEqual(validRecords.length, 0);
    });

    it('应该正确排序记录', () => {
      const sorted = analyzer.sortRecords(normalRecords);
      for (let i = 1; i < sorted.length; i++) {
        const prevTime = new Date(sorted[i - 1].createdAt).getTime();
        const currTime = new Date(sorted[i].createdAt).getTime();
        assert.ok(prevTime <= currTime, '记录应该按创建时间排序');
      }
    });
  });

  describe('概览统计功能', () => {
    it('应该生成正确的概览统计', () => {
      const result = analyzer.analyze(normalRecords);
      const summary = result.summary;
      
      assert.strictEqual(summary.totalTasks, normalRecords.length);
      assert.ok(summary.largeFileTasks >= 0);
      assert.ok(summary.successCount >= 0);
      assert.ok(summary.failedCount >= 0);
      assert.ok(summary.cancelledCount >= 0);
      assert.ok(summary.queuedCount >= 0);
      assert.ok(summary.processingCount >= 0);
      assert.ok(summary.analysisTime);
    });

    it('异常数据的概览统计应该包含取消和失败任务', () => {
      const result = analyzer.analyze(abnormalRecords);
      const summary = result.summary;
      
      assert.strictEqual(summary.totalTasks, abnormalRecords.length);
      assert.ok(summary.cancelledCount > 0, '应该有取消的任务');
      assert.ok(summary.failedCount > 0, '应该有失败的任务');
    });
  });

  describe('大文件任务分析功能', () => {
    it('应该正确识别大文件任务', () => {
      const result = analyzer.analyze(normalRecords);
      const largeFileTasks = result.largeFileTasks;
      
      largeFileTasks.forEach(task => {
        assert.ok(task.fileSize >= 100 * 1024 * 1024, '大文件任务的大小应该超过阈值');
        assert.ok(task.taskId);
        assert.ok(task.userId);
        assert.ok(task.fileName);
      });
    });

    it('大文件任务应该按文件大小降序排序', () => {
      const result = analyzer.analyze(normalRecords);
      const largeFileTasks = result.largeFileTasks;
      
      for (let i = 1; i < largeFileTasks.length; i++) {
        assert.ok(
          largeFileTasks[i - 1].fileSize >= largeFileTasks[i].fileSize,
          '大文件任务应该按文件大小降序排序'
        );
      }
    });
  });

  describe('重复任务检测功能', () => {
    it('应该正确检测到重复任务', () => {
      const result = analyzer.analyze(abnormalRecords);
      const duplicates = result.duplicateTasks;
      
      assert.ok(duplicates.length > 0, '应该检测到重复任务');
    });

    it('应该正确识别用户连点行为', () => {
      const result = analyzer.analyze(abnormalRecords);
      const duplicates = result.duplicateTasks;
      
      const rapidClicks = duplicates.filter(d => d.isUserDoubleClick);
      assert.ok(rapidClicks.length > 0, '应该检测到用户连点行为');
      
      rapidClicks.forEach(dup => {
        assert.ok(dup.timeDiffMs < 3000, '连点的时间间隔应该小于3秒');
      });
    });

    it('重复任务应该包含完整的关联信息', () => {
      const result = analyzer.analyze(abnormalRecords);
      const duplicates = result.duplicateTasks;
      
      duplicates.forEach(dup => {
        assert.ok(dup.groupKey);
        assert.ok(dup.userId);
        assert.ok(dup.fileName);
        assert.ok(dup.originalTask.taskId);
        assert.ok(dup.duplicateTask.taskId);
        assert.ok(dup.timeDiffMs >= 0);
      });
    });
  });

  describe('排队时长计算功能', () => {
    it('应该正确计算排队时长统计', () => {
      const result = analyzer.analyze(normalRecords);
      const queueDuration = result.queueDuration;
      
      assert.ok(queueDuration.allTasks);
      assert.ok(queueDuration.largeFileTasks);
      assert.ok(queueDuration.normalFileTasks);
      assert.ok(Array.isArray(queueDuration.longestWaits));
    });

    it('排队时长统计应该包含正确的统计值', () => {
      const result = analyzer.analyze(normalRecords);
      const allTasks = result.queueDuration.allTasks;
      
      if (allTasks.count > 0) {
        assert.ok(allTasks.min >= 0);
        assert.ok(allTasks.max >= allTasks.min);
        assert.ok(allTasks.avg >= 0);
        assert.ok(allTasks.median >= 0);
        assert.ok(allTasks.p95 >= 0);
      }
    });

    it('最长等待列表应该按等待时间降序排序', () => {
      const result = analyzer.analyze(normalRecords);
      const longestWaits = result.queueDuration.longestWaits;
      
      for (let i = 1; i < longestWaits.length; i++) {
        assert.ok(
          longestWaits[i - 1].waitTimeMs >= longestWaits[i].waitTimeMs,
          '最长等待列表应该按等待时间降序排序'
        );
      }
    });
  });

  describe('状态分布功能', () => {
    it('应该正确生成状态分布', () => {
      const result = analyzer.analyze(normalRecords);
      const breakdown = result.taskStatusBreakdown;
      
      const statuses = Object.keys(breakdown);
      assert.ok(statuses.length > 0);
      
      statuses.forEach(status => {
        assert.ok(breakdown[status].count >= 0);
        assert.ok(Array.isArray(breakdown[status].examples));
      });
    });
  });

  describe('用户重试模式分析功能', () => {
    it('应该正确分析用户重试模式', () => {
      const result = analyzer.analyze(abnormalRecords);
      const userPatterns = result.userRetryPatterns;
      
      assert.ok(Array.isArray(userPatterns));
      
      userPatterns.forEach(user => {
        assert.ok(user.userId);
        assert.ok(user.totalTasks >= 2);
        assert.ok(user.retryTasks >= 0);
        assert.ok(user.cancelledTasks >= 0);
      });
    });

    it('应该正确识别有快速重试的用户', () => {
      const result = analyzer.analyze(abnormalRecords);
      const userPatterns = result.userRetryPatterns;
      
      const rapidRetryUsers = userPatterns.filter(u => u.hasRapidRetries);
      assert.ok(rapidRetryUsers.length > 0, '应该检测到有快速重试的用户');
    });
  });

  describe('压缩失败分析功能', () => {
    it('应该正确识别压缩失败的任务', () => {
      const result = analyzer.analyze(abnormalRecords);
      const compressionFailures = result.compressionFailures;
      
      assert.ok(compressionFailures.length > 0, '应该检测到压缩失败的任务');
      
      compressionFailures.forEach(fail => {
        assert.strictEqual(fail.status, 'failed');
        assert.ok(fail.isCompression !== false);
        assert.ok(fail.errorMessage);
      });
    });
  });

  describe('取消任务分析功能', () => {
    it('应该正确识别已取消的任务', () => {
      const result = analyzer.analyze(abnormalRecords);
      const cancelledTasks = result.cancelledTasks;
      
      assert.ok(cancelledTasks.length > 0, '应该检测到已取消的任务');
      
      cancelledTasks.forEach(task => {
        assert.strictEqual(task.status, 'cancelled');
        assert.ok(task.cancelledBy);
        assert.ok(task.reason);
      });
    });

    it('已取消任务应该包含排队时长信息', () => {
      const result = analyzer.analyze(abnormalRecords);
      const cancelledTasks = result.cancelledTasks;
      
      cancelledTasks.forEach(task => {
        if (task.cancelledAt) {
          assert.ok(task.timeInQueueMs !== null);
          assert.ok(task.timeInQueueFormatted);
        }
      });
    });
  });

  describe('输出格式化功能', () => {
    it('应该正确生成文本格式输出', () => {
      const result = analyzer.analyze(normalRecords);
      const textOutput = analyzer.formatOutput(result, 'text');
      
      assert.strictEqual(typeof textOutput, 'string');
      assert.ok(textOutput.includes('导出任务记录大文件排队分析报告'));
      assert.ok(textOutput.includes('【概览统计】'));
      assert.ok(textOutput.includes('【排队时长统计】'));
      assert.ok(textOutput.includes('【大文件任务详情】'));
    });

    it('应该正确生成JSON格式输出', () => {
      const result = analyzer.analyze(normalRecords);
      const jsonOutput = analyzer.formatOutput(result, 'json');
      
      assert.strictEqual(typeof jsonOutput, 'string');
      const parsed = JSON.parse(jsonOutput);
      assert.ok(parsed.summary);
      assert.ok(parsed.largeFileTasks);
      assert.ok(parsed.duplicateTasks);
    });

    it('异常数据的输出应该包含所有异常分析部分', () => {
      const result = analyzer.analyze(abnormalRecords);
      const textOutput = analyzer.formatOutput(result, 'text');
      
      assert.ok(textOutput.includes('【重复任务检测】'));
      assert.ok(textOutput.includes('【用户重试模式分析】'));
      assert.ok(textOutput.includes('【压缩失败分析】'));
      assert.ok(textOutput.includes('【取消任务分析】'));
    });
  });

  describe('工具函数测试', () => {
    it('应该正确格式化文件大小', () => {
      const size1 = analyzer.formatFileSize(1024);
      assert.strictEqual(size1, '1.00KB');
      
      const size2 = analyzer.formatFileSize(1024 * 1024);
      assert.strictEqual(size2, '1.00MB');
      
      const size3 = analyzer.formatFileSize(1024 * 1024 * 1024);
      assert.strictEqual(size3, '1.00GB');
    });

    it('应该正确格式化时长', () => {
      const time1 = analyzer.formatDuration(500);
      assert.strictEqual(time1, '500毫秒');
      
      const time2 = analyzer.formatDuration(2500);
      assert.strictEqual(time2, '2.5秒');
      
      const time3 = analyzer.formatDuration(90000);
      assert.strictEqual(time3, '1分30秒');
    });
  });

  describe('业务场景集成测试', () => {
    it('正常数据路径分析应该输出清晰的业务字段', () => {
      const result = analyzer.analyze(normalRecords);
      const textOutput = analyzer.formatOutput(result, 'text');
      
      assert.ok(textOutput.includes('2024年度销售数据汇总.xlsx'));
      assert.ok(textOutput.includes('产品库存全量数据.xlsx'));
      assert.ok(textOutput.includes('张三'));
      assert.ok(textOutput.includes('李四'));
      assert.ok(textOutput.includes('Excel报表'));
    });

    it('异常数据路径分析应该检测到所有异常类型', () => {
      const result = analyzer.analyze(abnormalRecords);
      const textOutput = analyzer.formatOutput(result, 'text');
      
      assert.ok(textOutput.includes('周经理'), '应该包含有连点行为的用户名');
      assert.ok(textOutput.includes('5月销售业绩报表.xlsx'), '应该包含重复导出的文件名');
      assert.ok(textOutput.includes('疑似快速点击'), '应该标记疑似快速点击');
      assert.ok(textOutput.includes('压缩时内存不足'), '应该包含压缩失败的错误信息');
      assert.ok(textOutput.includes('处理超时'), '应该包含超时取消的原因');
      assert.ok(textOutput.includes('用户取消后重试'), '应该包含状态关系');
    });

    it('分析结果应该可以直接用于diff比较', () => {
      const result1 = analyzer.analyze(normalRecords);
      const output1 = analyzer.formatOutput(result1, 'text');
      
      const result2 = analyzer.analyze(normalRecords);
      const output2 = analyzer.formatOutput(result2, 'text');
      
      const lines1 = output1.split('\n').filter(line => !line.includes('分析时间'));
      const lines2 = output2.split('\n').filter(line => !line.includes('分析时间'));
      
      assert.deepStrictEqual(lines1, lines2, '相同输入应该产生相同的输出（除了时间戳）');
    });
  });
});
