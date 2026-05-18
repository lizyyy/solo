const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { UnpackEngine } = require('../src/unpack-engine.js');

const TEST_INPUT_DIR = path.join(__dirname, '..', 'samples', 'input');
const TEST_ANNOTATOR_FILE = path.join(__dirname, '..', 'samples', 'active-annotators.json');

describe('UnpackEngine - 标注任务导出返工拆包清理', () => {

  describe('1. 正常路径 - 拆出返工包', () => {
    it('应该正确识别并筛选出返工任务', () => {
      const engine = new UnpackEngine({});
      const testFiles = [path.join(TEST_INPUT_DIR, 'batch-001-normal.json')];
      const results = engine.process(testFiles, TEST_INPUT_DIR);
      
      // 总任务数: 4, 返工任务数: 3 (TASK-003 不是返工)
      assert.strictEqual(results.stats.totalTasks, 4);
      assert.strictEqual(results.stats.reworkTasks, 3);
      assert.strictEqual(results.tasks.length, 3);
    });

    it('应该支持多种返工状态标记方式', () => {
      const engine = new UnpackEngine({});
      const testFiles = [path.join(TEST_INPUT_DIR, 'batch-002-duplicates.json')];
      const results = engine.process(testFiles, TEST_INPUT_DIR);
      
      // batch-002 中 TASK-006 status=rejected 也算返工
      assert.strictEqual(results.stats.reworkTasks, 3);
    });
  });

  describe('2. 正常路径 - 避免重复分配（去重）', () => {
    it('应该按 taskId 去重，排除重复任务', () => {
      const engine = new UnpackEngine({ dedup: true });
      const testFiles = [
        path.join(TEST_INPUT_DIR, 'batch-001-normal.json'),
        path.join(TEST_INPUT_DIR, 'batch-002-duplicates.json')
      ];
      const results = engine.process(testFiles, TEST_INPUT_DIR);
      
      // batch-001 有 3 返工, batch-002 有 3 返工, 其中 TASK-001 重复
      // 所以去重后应该是 5 个任务，去重排除数 = 1
      assert.strictEqual(results.stats.duplicateRemoved, 1);
      assert.strictEqual(results.tasks.length, 5);
    });

    it('禁用去重时应该保留重复任务', () => {
      const engine = new UnpackEngine({ dedup: false });
      const testFiles = [
        path.join(TEST_INPUT_DIR, 'batch-001-normal.json'),
        path.join(TEST_INPUT_DIR, 'batch-002-duplicates.json')
      ];
      const results = engine.process(testFiles, TEST_INPUT_DIR);
      
      assert.strictEqual(results.stats.duplicateRemoved, 0);
      assert.strictEqual(results.tasks.length, 6);
    });
  });

  describe('3. 正常路径 - 人员离职处理', () => {
    it('应该过滤掉离职标注员的任务', () => {
      const engine = new UnpackEngine({ 
        dedup: true,
        annotatorFile: TEST_ANNOTATOR_FILE 
      });
      // batch-003 中有 钱七、周八 两个离职人员的任务
      const testFiles = [path.join(TEST_INPUT_DIR, 'batch-003-left-annotator.json')];
      const results = engine.process(testFiles, TEST_INPUT_DIR);
      
      // 总返工 3 个，排除 2 个离职人员的，剩下 1 个（张三）
      assert.strictEqual(results.stats.leftAnnotatorRemoved, 2);
      assert.strictEqual(results.tasks.length, 1);
      assert.strictEqual(results.tasks[0].annotator, '张三');
    });
  });

  describe('4. 正常路径 - 包号重叠合并', () => {
    it('应该标记跨文件的同 packageId 任务为重叠包', () => {
      const engine = new UnpackEngine({ dedup: true });
      // batch-001 和 batch-004 都用了 PKG-2024-0501-A
      const testFiles = [
        path.join(TEST_INPUT_DIR, 'batch-001-normal.json'),
        path.join(TEST_INPUT_DIR, 'batch-004-overlap.json')
      ];
      const results = engine.process(testFiles, TEST_INPUT_DIR);
      
      // overlapMerged 是跨文件重叠的包的数量，应该是 1 个重叠包
      assert.strictEqual(results.stats.overlapMerged, 1);
      
      // 检查是否有 packageOverlap 标记
      const overlapTasks = results.tasks.filter(t => t.packageOverlap === true);
      assert.ok(overlapTasks.length > 0, '应该有任务被标记为跨文件重叠包');
      assert.ok(overlapTasks[0].mergedFromSources.length > 1, '应该记录合并来源');
    });
  });

  describe('5. 正常路径 - 抽检失败标记', () => {
    it('应该正确统计抽检失败任务数', () => {
      const engine = new UnpackEngine({});
      const testFiles = [path.join(TEST_INPUT_DIR, 'batch-005-inspection-failed.json')];
      const results = engine.process(testFiles, TEST_INPUT_DIR);
      
      // batch-005 有 2 个抽检失败任务
      assert.strictEqual(results.stats.inspectionFailed, 2);
    });

    it('应该给抽检失败的标注员标记为 HIGH 风险等级', () => {
      const engine = new UnpackEngine({});
      const testFiles = [path.join(TEST_INPUT_DIR, 'batch-005-inspection-failed.json')];
      const results = engine.process(testFiles, TEST_INPUT_DIR);
      
      const zhaoLiu = results.reviewerReport.find(r => r.annotator === '赵六');
      assert.ok(zhaoLiu, '应该有赵六的报告');
      assert.strictEqual(zhaoLiu.riskLevel, 'HIGH', '赵六连续抽检失败，应该是 HIGH 风险');
      assert.strictEqual(zhaoLiu.inspectionFails, 2);
    });
  });

  describe('6. 正常路径 - CSV 格式支持', () => {
    it('应该支持解析 CSV 格式的导出文件', () => {
      const engine = new UnpackEngine({});
      const testFiles = [path.join(TEST_INPUT_DIR, 'batch-006-csv-format.csv')];
      const results = engine.process(testFiles, TEST_INPUT_DIR);
      
      // 3 个任务，其中 2 个返工
      assert.strictEqual(results.stats.totalTasks, 3);
      assert.strictEqual(results.stats.reworkTasks, 2);
    });
  });

  describe('7. 正常路径 - 完整流程集成测试', () => {
    it('应该正确处理所有场景混合的完整流程', () => {
      const engine = new UnpackEngine({ 
        dedup: true,
        annotatorFile: TEST_ANNOTATOR_FILE 
      });
      
      const allFiles = fs.readdirSync(TEST_INPUT_DIR)
        .filter(f => f.endsWith('.json') || f.endsWith('.csv'))
        .map(f => path.join(TEST_INPUT_DIR, f));
      
      const results = engine.process(allFiles, TEST_INPUT_DIR);
      
      console.log('  📊 这就是标注任务导出返工拆包清理的完整统计:');
      console.log(`    总任务数: ${results.stats.totalTasks}`);
      console.log(`    返工任务数: ${results.stats.reworkTasks}`);
      console.log(`    去重排除数: ${results.stats.duplicateRemoved}`);
      console.log(`    离职排除数: ${results.stats.leftAnnotatorRemoved}`);
      console.log(`    重叠包合并数: ${results.stats.overlapMerged}`);
      console.log(`    抽检失败数: ${results.stats.inspectionFailed}`);
      
      // 验证关键指标
      assert.strictEqual(results.stats.duplicateRemoved, 1, '去重排除数应该是 1');
      assert.strictEqual(results.stats.leftAnnotatorRemoved, 2, '离职排除数应该是 2');
      assert.ok(results.stats.overlapMerged >= 1, '重叠包合并数应该 >= 1');
      assert.strictEqual(results.stats.inspectionFailed, 2, '抽检失败数应该是 2');
      
      // 验证审计日志
      assert.ok(results.auditLog.length > 0, '应该有审计日志');
      
      // 验证风险等级
      const highRisk = results.reviewerReport.filter(r => r.riskLevel === 'HIGH');
      assert.ok(highRisk.length > 0, '应该有 HIGH 风险标注员');
    });
  });

  describe('8. 异常路径 - 文件验证', () => {
    it('应该能验证正确格式的文件', () => {
      const engine = new UnpackEngine({});
      const issues = engine.validateFile(path.join(TEST_INPUT_DIR, 'batch-001-normal.json'));
      assert.strictEqual(issues.length, 0, '正确文件应该没有验证问题');
    });

    it('应该能识别格式错误的文件', (t) => {
      const engine = new UnpackEngine({});
      const badFile = path.join(__dirname, 'bad-test-file.json');
      fs.writeFileSync(badFile, 'this is not valid json');
      
      const issues = engine.validateFile(badFile);
      assert.ok(issues.length > 0, '错误文件应该有验证问题');
      
      fs.unlinkSync(badFile);
    });
  });

  describe('9. 异常路径 - 边界情况', () => {
    it('处理空任务列表时应该不报错', () => {
      // 创建一个临时的空任务文件
      const emptyFile = path.join(__dirname, 'empty-tasks.json');
      fs.writeFileSync(emptyFile, JSON.stringify({ tasks: [] }));
      
      const engine = new UnpackEngine({});
      const results = engine.process([emptyFile], __dirname);
      
      assert.strictEqual(results.stats.totalTasks, 0);
      assert.strictEqual(results.stats.reworkTasks, 0);
      
      fs.unlinkSync(emptyFile);
    });

    it('没有标注员名单时应该不过滤任何标注员', () => {
      const engine = new UnpackEngine({ 
        annotatorFile: null 
      });
      const testFiles = [path.join(TEST_INPUT_DIR, 'batch-003-left-annotator.json')];
      const results = engine.process(testFiles, TEST_INPUT_DIR);
      
      // 没有名单时，钱七和周八的任务应该保留
      assert.strictEqual(results.stats.leftAnnotatorRemoved, 0);
      assert.strictEqual(results.tasks.length, 3);
    });
  });
});
