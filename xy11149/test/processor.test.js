const fs = require('fs-extra');
const path = require('path');
const { processDirectory, validateRow, generateRowHash } = require('../src/processor');

describe('园艺病害归档处理测试', () => {
  
  describe('行验证功能', () => {
    test('验证正常记录应无错误', () => {
      const seenHashes = new Set();
      const row = {
        recordId: 'R001',
        shootTime: '2024-03-15 09:30',
        location: '月季园A区',
        diseaseType: '白粉病',
        severity: '3'
      };
      const errors = validateRow(row, 1, seenHashes);
      expect(errors.length).toBe(0);
    });

    test('识别位置缺失的记录', () => {
      const seenHashes = new Set();
      const row = {
        recordId: 'R001',
        shootTime: '2024-03-15 09:30',
        location: '',
        diseaseType: '白粉病',
        severity: '3'
      };
      const errors = validateRow(row, 1, seenHashes);
      expect(errors.some(e => e.type === '位置缺失')).toBe(true);
    });

    test('识别重复拍摄的记录', () => {
      const seenHashes = new Set();
      const row1 = {
        recordId: 'R001',
        shootTime: '2024-03-15 09:30',
        location: '月季园A区',
        diseaseType: '白粉病',
        severity: '3'
      };
      validateRow(row1, 1, seenHashes);
      
      const row2 = {
        recordId: 'R002',
        shootTime: '2024-03-15 09:30',
        location: '月季园A区',
        diseaseType: '白粉病',
        severity: '3'
      };
      const errors = validateRow(row2, 2, seenHashes);
      expect(errors.some(e => e.type === '重复拍摄')).toBe(true);
    });

    test('识别严重程度超出范围的记录', () => {
      const seenHashes = new Set();
      const row = {
        recordId: 'R001',
        shootTime: '2024-03-15 09:30',
        location: '月季园A区',
        diseaseType: '白粉病',
        severity: '6'
      };
      const errors = validateRow(row, 1, seenHashes);
      expect(errors.some(e => e.type === '数据异常')).toBe(true);
    });
  });

  describe('目录处理功能', () => {
    const testDataDir = path.join(__dirname, 'test-data');
    const testEmptyDir = path.join(testDataDir, 'empty');
    const testBadDir = path.join(testDataDir, 'bad');
    const testNormalDir = path.join(testDataDir, 'normal');
    const outputDir = path.join(__dirname, 'test-output');

    beforeEach(async () => {
      await fs.remove(testDataDir);
      await fs.remove(outputDir);
      await fs.ensureDir(testEmptyDir);
      await fs.ensureDir(testBadDir);
      await fs.ensureDir(testNormalDir);
      await fs.ensureDir(outputDir);
    });

    afterEach(async () => {
      await fs.remove(testDataDir);
      await fs.remove(outputDir);
    });

    test('处理空目录', async () => {
      const result = await processDirectory(testEmptyDir, outputDir, false);
      expect(result.stats.emptyDir).toBe(true);
      expect(result.invalid.length).toBeGreaterThan(0);
      expect(result.invalid[0].errorType).toBe('空目录');
    });

    test('处理包含坏行的CSV', async () => {
      const badCsvContent = `recordId,shootTime,location,diseaseType,severity,notes
R001,2024-03-15 09:30,月季园A区,白粉病,3,正常记录
坏行数据格式错乱
R003,2024-03-15 10:00,月季园B区,黑斑病,4,另一条正常记录`;
      
      await fs.writeFile(path.join(testBadDir, 'bad.csv'), badCsvContent);
      
      const result = await processDirectory(testBadDir, outputDir, false);
      expect(result.stats.total).toBeGreaterThan(0);
      expect(result.invalid.length).toBeGreaterThan(0);
    });

    test('重复执行可稳定识别', async () => {
      const csvContent = `recordId,shootTime,location,diseaseType,severity,notes
R001,2024-03-15 09:30,月季园A区,白粉病,3,正常记录
R002,2024-03-15 09:30,月季园A区,白粉病,3,重复记录
R003,2024-03-15 10:00,月季园B区,黑斑病,4,正常记录`;
      
      await fs.writeFile(path.join(testNormalDir, 'test.csv'), csvContent);
      
      const result1 = await processDirectory(testNormalDir, outputDir, false);
      const duplicates1 = result1.invalid.filter(i => i.errorType === '重复拍摄').length;
      expect(duplicates1).toBe(1);
      
      await fs.remove(path.join(outputDir, '.processed-hashes.json'));
      
      const result2 = await processDirectory(testNormalDir, outputDir, false);
      const duplicates2 = result2.invalid.filter(i => i.errorType === '重复拍摄').length;
      expect(duplicates2).toBe(1);
    });

    test('正常和异常结果分离输出', async () => {
      const csvContent = `recordId,shootTime,location,diseaseType,severity,notes
R001,2024-03-15 09:30,月季园A区,白粉病,3,正常记录
R002,2024-03-15 09:35,,蚜虫,2,位置缺失
R003,2024-03-15 10:00,月季园B区,黑斑病,4,正常记录`;
      
      await fs.writeFile(path.join(testNormalDir, 'test.csv'), csvContent);
      
      await processDirectory(testNormalDir, outputDir, false);
      
      expect(await fs.exists(path.join(outputDir, 'valid-records.csv'))).toBe(true);
      expect(await fs.exists(path.join(outputDir, 'invalid-records.csv'))).toBe(true);
      expect(await fs.exists(path.join(outputDir, 'report.json'))).toBe(true);
    });
  });

  describe('哈希生成功能', () => {
    test('相同组合生成相同哈希', () => {
      const row1 = {
        shootTime: '2024-03-15 09:30',
        location: '月季园A区',
        diseaseType: '白粉病'
      };
      const row2 = {
        shootTime: '2024-03-15 09:30',
        location: '月季园A区',
        diseaseType: '白粉病'
      };
      expect(generateRowHash(row1)).toBe(generateRowHash(row2));
    });

    test('不同组合生成不同哈希', () => {
      const row1 = {
        shootTime: '2024-03-15 09:30',
        location: '月季园A区',
        diseaseType: '白粉病'
      };
      const row2 = {
        shootTime: '2024-03-15 09:30',
        location: '月季园B区',
        diseaseType: '白粉病'
      };
      expect(generateRowHash(row1)).not.toBe(generateRowHash(row2));
    });
  });
});
