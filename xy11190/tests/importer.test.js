import { describe, it, beforeEach, after } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import { importFile, importDirectory, writeOutput } from '../src/importer.js';
import logger from '../src/logger.js';

const TEST_DIR = path.resolve('./test-temp');

describe('Importer', () => {
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
    
    if (!fs.existsSync(TEST_DIR)) {
      fs.mkdirSync(TEST_DIR, { recursive: true });
    }
  });

  after(() => {
    if (fs.existsSync(TEST_DIR)) {
      fs.rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  describe('importFile', () => {
    it('应成功导入正常的 CSV 文件', async () => {
      const csvContent = `摊位编号,摊主姓名,摊位类型,收费月份,应收金额,实收金额,收费状态
A001,张三,蔬菜类,2024-01,500,500,已缴
A002,李四,水果类,2024-01,800,800,已缴`;
      
      const filePath = path.join(TEST_DIR, 'normal.csv');
      fs.writeFileSync(filePath, csvContent, 'utf8');
      
      const result = await importFile(filePath);
      
      assert.strictEqual(result.length, 2);
      assert.strictEqual(logger.stats.validRecords, 2);
      assert.strictEqual(logger.stats.processedFiles, 1);
      assert.strictEqual(result[0].摊位编号, 'A001');
    });

    it('应处理缺少列的文件并记录错误', async () => {
      const csvContent = `摊位编号,摊主姓名,收费月份,应收金额,实收金额,收费状态
A001,张三,2024-01,500,500,已缴`;
      
      const filePath = path.join(TEST_DIR, 'missing-column.csv');
      fs.writeFileSync(filePath, csvContent, 'utf8');
      
      const result = await importFile(filePath);
      
      assert.strictEqual(result.length, 0);
      assert.strictEqual(logger.errors.length, 1);
      assert.ok(logger.errors[0].reason.includes('缺少必要列'));
    });

    it('应处理包含重复行的文件', async () => {
      const csvContent = `摊位编号,摊主姓名,摊位类型,收费月份,应收金额,实收金额,收费状态
A001,张三,蔬菜类,2024-01,500,500,已缴
A001,张三,蔬菜类,2024-01,500,500,已缴`;
      
      const filePath = path.join(TEST_DIR, 'duplicate.csv');
      fs.writeFileSync(filePath, csvContent, 'utf8');
      
      const result = await importFile(filePath);
      
      assert.ok(logger.errors.some(e => e.reason.includes('重复记录')));
    });

    it('应正确处理特殊情况记录', async () => {
      const csvContent = `摊位编号,摊主姓名,摊位类型,收费月份,应收金额,实收金额,收费状态
A001,张三,蔬菜类,2024-01,500,0,临时休市
A002,李四,水果类,2024-01,800,800,转租`;
      
      const filePath = path.join(TEST_DIR, 'special.csv');
      fs.writeFileSync(filePath, csvContent, 'utf8');
      
      const result = await importFile(filePath);
      
      assert.strictEqual(result.length, 2);
      assert.ok(logger.warnings.some(w => w.reason.includes('临时休市')));
      assert.ok(logger.warnings.some(w => w.reason.includes('转租')));
    });

    it('应记录无效数据的错误', async () => {
      const csvContent = `摊位编号,摊主姓名,摊位类型,收费月份,应收金额,实收金额,收费状态
A001,,蔬菜类,2024/01,-500,500,已缴`;
      
      const filePath = path.join(TEST_DIR, 'invalid.csv');
      fs.writeFileSync(filePath, csvContent, 'utf8');
      
      await importFile(filePath);
      
      assert.ok(logger.errors.some(e => e.reason.includes('摊主姓名不能为空')));
      assert.ok(logger.errors.some(e => e.reason.includes('收费月份格式错误')));
      assert.ok(logger.errors.some(e => e.reason.includes('应收金额必须为非负数')));
    });
  });

  describe('importDirectory', () => {
    it('应处理目录中的所有 CSV 文件', async () => {
      const csvContent1 = `摊位编号,摊主姓名,摊位类型,收费月份,应收金额,实收金额,收费状态
A001,张三,蔬菜类,2024-01,500,500,已缴`;
      const csvContent2 = `摊位编号,摊主姓名,摊位类型,收费月份,应收金额,实收金额,收费状态
B001,李四,水果类,2024-01,800,800,已缴`;
      
      fs.writeFileSync(path.join(TEST_DIR, 'file1.csv'), csvContent1, 'utf8');
      fs.writeFileSync(path.join(TEST_DIR, 'file2.csv'), csvContent2, 'utf8');
      
      const results = await importDirectory(TEST_DIR);
      
      assert.strictEqual(results.length, 2);
      assert.strictEqual(logger.stats.totalFiles, 2);
      assert.strictEqual(logger.stats.processedFiles, 2);
    });

    it('遇到部分失败时应继续处理其他文件', async () => {
      const validCsv = `摊位编号,摊主姓名,摊位类型,收费月份,应收金额,实收金额,收费状态
A001,张三,蔬菜类,2024-01,500,500,已缴`;
      const invalidCsv = `bad,csv,content`;
      
      fs.writeFileSync(path.join(TEST_DIR, 'valid.csv'), validCsv, 'utf8');
      fs.writeFileSync(path.join(TEST_DIR, 'invalid.csv'), invalidCsv, 'utf8');
      
      const results = await importDirectory(TEST_DIR);
      
      assert.ok(results.length >= 1);
      assert.ok(logger.stats.totalFiles >= 2);
    });
  });

  describe('writeOutput', () => {
    it('应将结果写入 JSON 文件', () => {
      const results = [{
        file: 'test.csv',
        records: [{ '摊位编号': 'A001', '摊主姓名': '张三' }]
      }];
      
      const outputPath = path.join(TEST_DIR, 'output.json');
      writeOutput(results, outputPath);
      
      assert.ok(fs.existsSync(outputPath));
      const content = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
      assert.strictEqual(content.files.length, 1);
      assert.strictEqual(content.files[0].file, 'test.csv');
    });
  });
});
