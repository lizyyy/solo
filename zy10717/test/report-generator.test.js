const { describe, it, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { ReportGenerator } = require('../src/report-generator.js');

describe('ReportGenerator - 标注任务导出返工拆包清理报告生成', () => {

  const testOutputDir = path.join(__dirname, 'test-output');

  after(() => {
    if (fs.existsSync(testOutputDir)) {
      fs.rmSync(testOutputDir, { recursive: true, force: true });
    }
  });

  const mockResults = {
    tasks: [
      { taskId: 'TASK-001', packageId: 'PKG-A', annotator: '张三', needRework: true, inspectionFailed: false, sourceFile: 'batch1.json' },
      { taskId: 'TASK-002', packageId: 'PKG-A', annotator: '李四', needRework: true, inspectionFailed: true, sourceFile: 'batch1.json', packageOverlap: true, mergedFromSources: ['a.json', 'b.json'] },
    ],
    packages: [
      { packageId: 'PKG-A', tasks: [], taskCount: 2, reworkCount: 2, inspectionFailCount: 1, annotators: ['张三', '李四'] }
    ],
    reviewerReport: [
      { annotator: '李四', tasks: [], totalRework: 1, inspectionFails: 1, packages: ['PKG-A'], riskLevel: 'HIGH' },
      { annotator: '张三', tasks: [], totalRework: 1, inspectionFails: 0, packages: ['PKG-A'], riskLevel: 'LOW' }
    ],
    auditLog: [
      { taskId: 'TASK-003', action: 'EXCLUDED', reason: 'not_rework', annotator: '王五', packageId: 'PKG-B', sourceFile: 'batch2.json' }
    ],
    stats: {
      totalTasks: 3,
      reworkTasks: 2,
      duplicateRemoved: 0,
      leftAnnotatorRemoved: 0,
      overlapMerged: 0,
      inspectionFailed: 1
    },
    metadata: {
      processedAt: new Date().toISOString(),
      options: {}
    }
  };

  describe('1. JSON 格式输出', () => {
    it('应该生成 JSON 格式的返工包文件', () => {
      const generator = new ReportGenerator();
      fs.mkdirSync(testOutputDir, { recursive: true });
      
      generator.generate(mockResults, testOutputDir, 'json');
      
      const packagesFile = path.join(testOutputDir, 'rework-packages.json');
      assert.ok(fs.existsSync(packagesFile), 'rework-packages.json 应该存在');
      
      const content = JSON.parse(fs.readFileSync(packagesFile, 'utf-8'));
      assert.strictEqual(content[0].packageId, 'PKG-A');
    });

    it('应该生成 reviewer-report.json', () => {
      const file = path.join(testOutputDir, 'reviewer-report.json');
      assert.ok(fs.existsSync(file), 'reviewer-report.json 应该存在');
      
      const content = JSON.parse(fs.readFileSync(file, 'utf-8'));
      assert.strictEqual(content.length, 2);
    });

    it('应该生成 audit-log.json', () => {
      const file = path.join(testOutputDir, 'audit-log.json');
      assert.ok(fs.existsSync(file), 'audit-log.json 应该存在');
      
      const content = JSON.parse(fs.readFileSync(file, 'utf-8'));
      assert.strictEqual(content.length, 1);
      assert.strictEqual(content[0].reason, 'not_rework');
    });

    it('应该生成 stats.json', () => {
      const file = path.join(testOutputDir, 'stats.json');
      assert.ok(fs.existsSync(file), 'stats.json 应该存在');
      
      const content = JSON.parse(fs.readFileSync(file, 'utf-8'));
      assert.strictEqual(content.totalTasks, 3);
    });
  });

  describe('2. CSV 格式输出', () => {
    it('应该生成 CSV 格式的文件', () => {
      const generator = new ReportGenerator();
      fs.rmSync(testOutputDir, { recursive: true, force: true });
      fs.mkdirSync(testOutputDir, { recursive: true });
      
      generator.generate(mockResults, testOutputDir, 'csv');
      
      const csvFile = path.join(testOutputDir, 'rework-packages.csv');
      assert.ok(fs.existsSync(csvFile), 'rework-packages.csv 应该存在');
      
      const content = fs.readFileSync(csvFile, 'utf-8');
      assert.ok(content.includes('packageId'), 'CSV 应该有表头');
      assert.ok(content.includes('PKG-A'), 'CSV 应该有数据');
    });
  });

  describe('3. 人类可读报告', () => {
    it('应该生成 SUMMARY.txt', () => {
      const summaryFile = path.join(testOutputDir, 'SUMMARY.txt');
      assert.ok(fs.existsSync(summaryFile), 'SUMMARY.txt 应该存在');
      
      const content = fs.readFileSync(summaryFile, 'utf-8');
      assert.ok(content.includes('标注任务导出返工拆包清理'), '应该包含工具名称');
      assert.ok(content.includes('统计数据'), '应该包含统计部分');
      assert.ok(content.includes('返工任务数:'), '应该包含返工统计');
    });

    it('应该生成 REVIEW-REPORT.txt', () => {
      const reportFile = path.join(testOutputDir, 'REVIEW-REPORT.txt');
      assert.ok(fs.existsSync(reportFile), 'REVIEW-REPORT.txt 应该存在');
      
      const content = fs.readFileSync(reportFile, 'utf-8');
      assert.ok(content.includes('返工任务清单'), '应该包含任务清单');
      assert.ok(content.includes('审计日志'), '应该包含审计日志');
      assert.ok(content.includes('复核检查要点'), '应该包含复核要点');
    });
  });

  describe('4. Diff 对比功能', () => {
    it('应该能对比两次输出的差异', () => {
      const generator = new ReportGenerator();
      
      // 创建两个不同的输出目录
      const dir1 = path.join(__dirname, 'diff-test-1');
      const dir2 = path.join(__dirname, 'diff-test-2');
      
      // 运行 1 - 没有离职排除
      fs.mkdirSync(dir1, { recursive: true });
      fs.writeFileSync(path.join(dir1, 'stats.json'), JSON.stringify({
        totalTasks: 10,
        reworkTasks: 5,
        leftAnnotatorRemoved: 0,
        overlapMerged: 0
      }));
      
      // 运行 2 - 有离职排除（模拟规则变更）
      fs.mkdirSync(dir2, { recursive: true });
      fs.writeFileSync(path.join(dir2, 'stats.json'), JSON.stringify({
        totalTasks: 8,
        reworkTasks: 5,
        leftAnnotatorRemoved: 2,
        overlapMerged: 0
      }));
      
      const diffResult = generator.generateDiff(dir1, dir2);
      
      assert.strictEqual(diffResult.hasChanges, true, '应该检测到差异');
      assert.ok(diffResult.changes.some(c => c.type === 'ANNOTATOR_LEFT'), '应该检测到离职排除数变化');
      assert.ok(diffResult.summary.includes('这就是标注任务导出返工拆包清理'), 'diff 输出应该有明确标记');
      
      // 清理
      fs.rmSync(dir1, { recursive: true, force: true });
      fs.rmSync(dir2, { recursive: true, force: true });
    });

    it('无差异时应该正确报告', () => {
      const generator = new ReportGenerator();
      
      const dir1 = path.join(__dirname, 'diff-same-1');
      const dir2 = path.join(__dirname, 'diff-same-2');
      
      const sameStats = JSON.stringify({
        totalTasks: 10,
        reworkTasks: 5,
        duplicateRemoved: 1,
        leftAnnotatorRemoved: 2
      });
      
      fs.mkdirSync(dir1, { recursive: true });
      fs.mkdirSync(dir2, { recursive: true });
      fs.writeFileSync(path.join(dir1, 'stats.json'), sameStats);
      fs.writeFileSync(path.join(dir2, 'stats.json'), sameStats);
      
      const diffResult = generator.generateDiff(dir1, dir2);
      
      assert.strictEqual(diffResult.hasChanges, false, '应该报告无差异');
      assert.ok(diffResult.summary.includes('无差异'), '应该显示无差异');
      
      fs.rmSync(dir1, { recursive: true, force: true });
      fs.rmSync(dir2, { recursive: true, force: true });
    });
  });
});
