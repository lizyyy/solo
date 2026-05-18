import { describe, it } from 'node:test';
import assert from 'node:assert';
import { parseFile } from '../src/parser.js';
import { validateRecords } from '../src/validator.js';
import { matchNoPlateVehicles } from '../src/matcher.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('停车场流水无牌车匹配复核 - 功能测试', () => {
  const normalSample = path.join(__dirname, '../examples/正常流水样例.csv');
  const exceptionSample = path.join(__dirname, '../examples/含异常流水样例.csv');

  describe('解析模块测试', () => {
    it('应正确解析正常CSV文件', async () => {
      const result = await parseFile(normalSample);
      assert.strictEqual(result.records.length, 10);
      assert.strictEqual(result.parseErrors.length, 0);
    });

    it('应提取正确的字段信息', async () => {
      const result = await parseFile(normalSample);
      const firstRecord = result.records[0];
      assert.strictEqual(firstRecord.流水号, 'P20240501001');
      assert.strictEqual(firstRecord.车牌号, '京A12345');
      assert.strictEqual(firstRecord.实收金额, 20);
    });

    it('应识别无牌车记录', async () => {
      const result = await parseFile(normalSample);
      const noPlateRecords = result.records.filter(r => !r.车牌号 || r.车牌号 === '无牌');
      assert.strictEqual(noPlateRecords.length, 2);
    });
  });

  describe('校验模块测试', () => {
    it('应检测重复支付记录', async () => {
      const parseResult = await parseFile(exceptionSample);
      const validateResult = validateRecords(parseResult.records);
      const duplicateErrors = validateResult.validationErrors.filter(r =>
        r.errors.some(e => e.type === '重复支付')
      );
      assert.ok(duplicateErrors.length >= 1);
    });

    it('应检测车道离线记录', async () => {
      const parseResult = await parseFile(exceptionSample);
      const validateResult = validateRecords(parseResult.records);
      const offlineErrors = validateResult.validationErrors.filter(r =>
        r.errors.some(e => e.type === '车道离线')
      );
      assert.ok(offlineErrors.length >= 1);
    });

    it('应检测照片缺失记录', async () => {
      const parseResult = await parseFile(exceptionSample);
      const validateResult = validateRecords(parseResult.records);
      const photoErrors = validateResult.validationErrors.filter(r =>
        r.errors.some(e => e.type === '照片缺失')
      );
      assert.ok(photoErrors.length >= 1);
    });

    it('应检测金额异常记录', async () => {
      const parseResult = await parseFile(exceptionSample);
      const validateResult = validateRecords(parseResult.records);
      const amountErrors = validateResult.validationErrors.filter(r =>
        r.errors.some(e => e.type === '金额异常')
      );
      assert.ok(amountErrors.length >= 1);
    });
  });

  describe('匹配模块测试', () => {
    it('应成功匹配无牌车记录', async () => {
      const parseResult = await parseFile(normalSample);
      const validateResult = validateRecords(parseResult.records);
      const matchResult = matchNoPlateVehicles(validateResult.validRecords);
      assert.ok(matchResult.matchedResults.length >= 1);
    });

    it('应包含匹配置信度', async () => {
      const parseResult = await parseFile(normalSample);
      const validateResult = validateRecords(parseResult.records);
      const matchResult = matchNoPlateVehicles(validateResult.validRecords);
      matchResult.matchedResults.forEach(r => {
        assert.ok(r.匹配置信度 >= 50);
      });
    });

    it('结果应按固定规则排序', async () => {
      const parseResult = await parseFile(normalSample);
      const validateResult = validateRecords(parseResult.records);
      const matchResult = matchNoPlateVehicles(validateResult.validRecords);
      const { allResults } = matchResult;
      
      for (let i = 1; i < allResults.length; i++) {
        const prev = allResults[i - 1];
        const curr = allResults[i];
        
        if (prev.匹配状态 !== curr.匹配状态) {
          assert.strictEqual(prev.匹配状态, '匹配成功');
          assert.strictEqual(curr.匹配状态, '未匹配');
        } else if (prev.匹配状态 === curr.匹配状态 && prev.匹配置信度 !== curr.匹配置信度) {
          assert.ok(prev.匹配置信度 >= curr.匹配置信度);
        }
      }
    });
  });

  describe('业务规则验证', () => {
    it('遇到异常时应继续处理剩余文件', async () => {
      const parseResult = await parseFile(exceptionSample);
      const validateResult = validateRecords(parseResult.records);
      const matchResult = matchNoPlateVehicles(validateResult.validRecords);
      
      assert.strictEqual(validateResult.validRecords.length, 10);
      assert.ok(matchResult.allResults.length >= 1);
    });

    it('异常报告应包含所有异常类型的原因', async () => {
      const parseResult = await parseFile(exceptionSample);
      const validateResult = validateRecords(parseResult.records);
      
      const errorTypes = new Set();
      validateResult.validationErrors.forEach(record => {
        record.errors.forEach(error => {
          errorTypes.add(error.type);
        });
      });
      
      assert.ok(errorTypes.has('重复支付'));
      assert.ok(errorTypes.has('车道离线'));
      assert.ok(errorTypes.has('照片缺失'));
      assert.ok(errorTypes.has('金额异常'));
    });
  });
});
