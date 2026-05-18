import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { validateHeaders, validateRecord, checkDuplicates, calculateFees } from '../src/validator.js';
import logger from '../src/logger.js';

describe('Validator', () => {
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
  });

  describe('validateHeaders', () => {
    it('应通过包含所有必要列的表头验证', () => {
      const headers = ['摊位编号', '摊主姓名', '摊位类型', '收费月份', '应收金额', '实收金额', '收费状态'];
      const result = validateHeaders(headers, 'test.csv');
      assert.strictEqual(result, true);
      assert.strictEqual(logger.errors.length, 0);
    });

    it('应检测缺少的列并记录错误', () => {
      const headers = ['摊位编号', '摊主姓名', '收费月份', '应收金额', '实收金额', '收费状态'];
      const result = validateHeaders(headers, 'test.csv');
      assert.strictEqual(result, false);
      assert.strictEqual(logger.errors.length, 1);
      assert.ok(logger.errors[0].reason.includes('缺少必要列'));
      assert.ok(logger.errors[0].reason.includes('摊位类型'));
    });
  });

  describe('validateRecord', () => {
    it('应验证有效记录并返回成功', () => {
      const record = {
        '摊位编号': 'A001',
        '摊主姓名': '张三',
        '摊位类型': '蔬菜类',
        '收费月份': '2024-01',
        '应收金额': '500',
        '实收金额': '500',
        '收费状态': '已缴'
      };
      const result = validateRecord(record, 2, 'test.csv');
      assert.strictEqual(result.isValid, true);
      assert.strictEqual(result.errors.length, 0);
    });

    it('应检测空摊位编号错误', () => {
      const record = {
        '摊位编号': '',
        '摊主姓名': '张三',
        '摊位类型': '蔬菜类',
        '收费月份': '2024-01',
        '应收金额': '500',
        '实收金额': '500',
        '收费状态': '已缴'
      };
      const result = validateRecord(record, 2, 'test.csv');
      assert.strictEqual(result.isValid, false);
      assert.ok(result.errors.includes('摊位编号不能为空'));
    });

    it('应检测空摊主姓名错误', () => {
      const record = {
        '摊位编号': 'A001',
        '摊主姓名': '',
        '摊位类型': '蔬菜类',
        '收费月份': '2024-01',
        '应收金额': '500',
        '实收金额': '500',
        '收费状态': '已缴'
      };
      const result = validateRecord(record, 2, 'test.csv');
      assert.strictEqual(result.isValid, false);
      assert.ok(result.errors.includes('摊主姓名不能为空'));
    });

    it('应检测收费月份格式错误', () => {
      const record = {
        '摊位编号': 'A001',
        '摊主姓名': '张三',
        '摊位类型': '蔬菜类',
        '收费月份': '2024/01',
        '应收金额': '500',
        '实收金额': '500',
        '收费状态': '已缴'
      };
      const result = validateRecord(record, 2, 'test.csv');
      assert.strictEqual(result.isValid, false);
      assert.ok(result.errors.includes('收费月份格式错误，应为 YYYY-MM'));
    });

    it('应检测负应收金额错误', () => {
      const record = {
        '摊位编号': 'A001',
        '摊主姓名': '张三',
        '摊位类型': '蔬菜类',
        '收费月份': '2024-01',
        '应收金额': '-100',
        '实收金额': '500',
        '收费状态': '已缴'
      };
      const result = validateRecord(record, 2, 'test.csv');
      assert.strictEqual(result.isValid, false);
      assert.ok(result.errors.includes('应收金额必须为非负数'));
    });

    it('应记录临时休市警告', () => {
      const record = {
        '摊位编号': 'A001',
        '摊主姓名': '张三',
        '摊位类型': '蔬菜类',
        '收费月份': '2024-01',
        '应收金额': '500',
        '实收金额': '500',
        '收费状态': '临时休市'
      };
      const result = validateRecord(record, 2, 'test.csv');
      assert.strictEqual(result.isValid, true);
      assert.ok(result.warnings.includes('临时休市，该月费用需另行核算'));
    });

    it('应记录转租警告', () => {
      const record = {
        '摊位编号': 'A001',
        '摊主姓名': '张三',
        '摊位类型': '蔬菜类',
        '收费月份': '2024-01',
        '应收金额': '500',
        '实收金额': '500',
        '收费状态': '转租'
      };
      const result = validateRecord(record, 2, 'test.csv');
      assert.strictEqual(result.isValid, true);
      assert.ok(result.warnings.includes('转租摊位，需核实新摊主信息'));
    });
  });

  describe('checkDuplicates', () => {
    it('应检测重复记录', () => {
      const records = [
        { '摊位编号': 'A001', '收费月份': '2024-01', '摊主姓名': '张三' },
        { '摊位编号': 'A001', '收费月份': '2024-01', '摊主姓名': '张三' },
        { '摊位编号': 'A002', '收费月份': '2024-01', '摊主姓名': '李四' }
      ];
      const duplicates = checkDuplicates(records, 'test.csv');
      assert.strictEqual(duplicates.length, 1);
      assert.strictEqual(logger.errors.length, 1);
      assert.ok(logger.errors[0].reason.includes('重复记录'));
    });

    it('对于无重复记录应返回空数组', () => {
      const records = [
        { '摊位编号': 'A001', '收费月份': '2024-01', '摊主姓名': '张三' },
        { '摊位编号': 'A002', '收费月份': '2024-01', '摊主姓名': '李四' }
      ];
      const duplicates = checkDuplicates(records, 'test.csv');
      assert.strictEqual(duplicates.length, 0);
      assert.strictEqual(logger.errors.length, 0);
    });
  });

  describe('calculateFees', () => {
    it('应计算欠费金额并标记有欠费状态', () => {
      const records = [{
        '摊位编号': 'A001',
        '摊主姓名': '张三',
        '应收金额': '1000',
        '实收金额': '800',
        '收费状态': '部分缴纳'
      }];
      const result = calculateFees(records);
      assert.strictEqual(result[0].欠费金额, 200);
      assert.strictEqual(result[0].核对结果, '有欠费');
    });

    it('应标记临时休市待处理状态', () => {
      const records = [{
        '摊位编号': 'A001',
        '摊主姓名': '张三',
        '应收金额': '500',
        '实收金额': '0',
        '收费状态': '临时休市'
      }];
      const result = calculateFees(records);
      assert.strictEqual(result[0].核对结果, '临时休市待处理');
    });

    it('应标记转租待核实状态', () => {
      const records = [{
        '摊位编号': 'A001',
        '摊主姓名': '张三',
        '应收金额': '500',
        '实收金额': '500',
        '收费状态': '转租'
      }];
      const result = calculateFees(records);
      assert.strictEqual(result[0].核对结果, '转租待核实');
    });

    it('应标记预存/多缴状态', () => {
      const records = [{
        '摊位编号': 'A001',
        '摊主姓名': '张三',
        '应收金额': '500',
        '实收金额': '600',
        '收费状态': '已缴'
      }];
      const result = calculateFees(records);
      assert.strictEqual(result[0].欠费金额, -100);
      assert.strictEqual(result[0].核对结果, '预存/多缴');
    });
  });
});
