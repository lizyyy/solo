const { describe, it, before, after } = require('node:test');
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  parseCSV,
  parseJSON,
  validateFields,
  removeDuplicates,
  trackReshoots,
  resolveDuplicateLocations,
  processFiles,
  toCSV,
  toJSON,
  toMarkdown
} = require('../src/core');

const tempDir = path.join(__dirname, 'temp');

describe('旅拍客服组照片交付 - 核心功能测试', () => {
  before(() => {
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
  });

  after(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('CSV 解析测试', () => {
    it('应正确解析 CSV 并记录源文件行号', () => {
      const csvContent = `订单号,客户姓名,拍摄地点,文件名
LP001,张三,三亚,三亚_001.jpg
LP002,李四,丽江,丽江_001.jpg`;
      
      const records = parseCSV(csvContent, 'test.csv');
      
      assert.strictEqual(records.length, 2);
      assert.strictEqual(records[0]._source.file, 'test.csv');
      assert.strictEqual(records[0]._source.line, 2);
      assert.strictEqual(records[1]._source.line, 3);
      assert.strictEqual(records[0]['订单号'], 'LP001');
    });

    it('处理空 CSV 文件应返回空数组', () => {
      const records = parseCSV('', 'empty.csv');
      assert.strictEqual(records.length, 0);
    });
  });

  describe('字段验证测试 - 缺列处理', () => {
    it('应正确检测缺少必填字段的记录', () => {
      const records = [
        { '订单号': 'LP001', '客户姓名': '张三', '拍摄地点': '三亚', '文件名': 'test.jpg' },
        { '订单号': 'LP002', '客户姓名': '李四', '文件名': 'test2.jpg' },
        { '订单号': 'LP003' }
      ];

      const validated = validateFields(records);

      assert.strictEqual(validated[0]._validation.isValid, true);
      assert.strictEqual(validated[1]._validation.isValid, false);
      assert.deepStrictEqual(validated[1]._validation.missingFields, ['拍摄地点']);
      assert.strictEqual(validated[2]._validation.missingFields.length, 3);
    });
  });

  describe('重复行处理测试', () => {
    it('应正确识别和移除重复记录', () => {
      const records = [
        { '订单号': 'LP001', '客户姓名': '张三', '拍摄地点': '三亚', '文件名': '三亚_001.jpg' },
        { '订单号': 'LP001', '客户姓名': '张三', '拍摄地点': '三亚', '文件名': '三亚_001.jpg' },
        { '订单号': 'LP001', '客户姓名': '张三', '拍摄地点': '三亚', '文件名': '三亚_001.jpg' },
        { '订单号': 'LP002', '客户姓名': '李四', '拍摄地点': '丽江', '文件名': '丽江_001.jpg' }
      ];

      const { unique, duplicates } = removeDuplicates(records);

      assert.strictEqual(unique.length, 2);
      assert.strictEqual(duplicates.length, 2);
      assert.strictEqual(unique[0]._isDuplicate, false);
      assert.strictEqual(duplicates[0]._isDuplicate, true);
    });
  });

  describe('补拍追踪测试', () => {
    it('应正确追踪同一订单的多次补拍', () => {
      const records = [
        { '订单号': 'LP001', '是否补拍': '否', '文件名': '三亚_001.jpg' },
        { '订单号': 'LP001', '是否补拍': '是', '文件名': '三亚_001.jpg' },
        { '订单号': 'LP001', '是否补拍': '是', '文件名': '三亚_001.jpg' },
        { '订单号': 'LP002', '是否补拍': '否', '文件名': '丽江_001.jpg' }
      ];

      const tracked = trackReshoots(records);

      assert.strictEqual(tracked[1]._reshootInfo.isReshoot, true);
      assert.strictEqual(tracked[1]._reshootInfo.totalReshoots, 2);
      assert.strictEqual(tracked[1]._reshootInfo.hasMultipleReshoots, true);
    });
  });

  describe('多地点同名文件处理测试', () => {
    it('应正确处理不同地点相同文件名的情况', () => {
      const records = [
        { '订单号': 'LP001', '文件名': '海边_001.jpg', '拍摄地点': '三亚' },
        { '订单号': 'LP002', '文件名': '海边_001.jpg', '拍摄地点': '青岛' },
        { '订单号': 'LP003', '文件名': '海边_001.jpg', '拍摄地点': '三亚' }
      ];

      const resolved = resolveDuplicateLocations(records);

      assert.strictEqual(resolved.length, 3);
      assert.strictEqual(resolved[0]._duplicateResolved, true);
      assert.strictEqual(resolved[2]._duplicateResolved, true);
    });
  });

  describe('空文件处理测试', () => {
    it('处理空文件时应正确记录错误并继续', () => {
      const emptyFile = path.join(tempDir, 'empty.csv');
      fs.writeFileSync(emptyFile, '', 'utf-8');

      const normalFile = path.join(tempDir, 'normal.csv');
      fs.writeFileSync(normalFile, `订单号,客户姓名,拍摄地点,文件名\nLP001,张三,三亚,test.jpg`, 'utf-8');

      const result = processFiles([emptyFile, normalFile], { continueOnError: true });

      assert.strictEqual(result.stats.failedFiles, 1);
      assert.strictEqual(result.stats.processedFiles, 1);
      assert.strictEqual(result.errors.length, 1);
      assert.strictEqual(result.errors[0].error, '文件为空');
    });
  });

  describe('部分失败继续处理测试', () => {
    it('部分文件失败时应继续处理其他文件', () => {
      const badFile = path.join(tempDir, 'bad.txt');
      fs.writeFileSync(badFile, '这不是 CSV 格式', 'utf-8');

      const goodFile = path.join(tempDir, 'good.csv');
      fs.writeFileSync(goodFile, `订单号,客户姓名,拍摄地点,文件名\nLP001,张三,三亚,test.jpg`, 'utf-8');

      const result = processFiles([badFile, goodFile], { continueOnError: true });

      assert.strictEqual(result.stats.failedFiles, 1);
      assert.strictEqual(result.stats.processedFiles, 1);
      assert.strictEqual(result.data.length, 1);
      assert.strictEqual(result.errors.length, 1);
    });

    it('不启用 continueOnError 时遇到错误应抛出异常', () => {
      const badFile = path.join(tempDir, 'bad2.txt');
      fs.writeFileSync(badFile, 'invalid', 'utf-8');

      assert.throws(() => {
        processFiles([badFile], { continueOnError: false });
      });
    });
  });

  describe('输出格式测试', () => {
    it('应正确输出 CSV 格式', () => {
      const records = [
        { '订单号': 'LP001', '客户姓名': '张三', '拍摄地点': '三亚', '文件名': 'test.jpg' }
      ];

      const csv = toCSV(records);
      assert.ok(csv.includes('订单号'));
      assert.ok(csv.includes('LP001'));
    });

    it('应正确输出 JSON 格式', () => {
      const records = [{ '订单号': 'LP001' }];
      const json = toJSON(records);
      const parsed = JSON.parse(json);
      assert.strictEqual(parsed.length, 1);
    });

    it('应正确输出 Markdown 格式', () => {
      const records = [
        { 
          '订单号': 'LP001', 
          '客户姓名': '张三', 
          '拍摄地点': '三亚', 
          '文件名': 'test.jpg',
          _source: { file: 'test.csv', line: 2 },
          _validation: { isValid: true, status: '待处理' }
        }
      ];

      const md = toMarkdown(records);
      assert.ok(md.includes('| 订单号 |'));
      assert.ok(md.includes('LP001'));
    });
  });

  describe('源文件和行号追踪测试', () => {
    it('应正确记录每条记录的源文件和行号', () => {
      const testFile = path.join(tempDir, 'source-test.csv');
      fs.writeFileSync(testFile, `订单号,客户姓名,拍摄地点,文件名
LP001,张三,三亚,三亚_001.jpg
LP002,李四,丽江,丽江_001.jpg
LP003,王五,大理,大理_001.jpg`, 'utf-8');

      const result = processFiles([testFile]);

      assert.strictEqual(result.data[0]._source.file, testFile);
      assert.strictEqual(result.data[0]._source.line, 2);
      assert.strictEqual(result.data[1]._source.line, 3);
      assert.strictEqual(result.data[2]._source.line, 4);
    });
  });
});
