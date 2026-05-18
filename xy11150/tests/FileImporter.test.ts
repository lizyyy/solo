import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as iconv from 'iconv-lite';
import { FileImporter, ColumnMappingError, FileImportError } from '../src/importer/FileImporter';

describe('FileImporter', () => {
  let tempDir: string;
  let importer: FileImporter;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shuttle-test-'));
    importer = new FileImporter();
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true });
    }
  });

  const createTestFile = (filename: string, content: string): string => {
    const filePath = path.join(tempDir, filename);
    fs.writeFileSync(filePath, content, 'utf8');
    return filePath;
  };

  describe('正常导入测试', () => {
    it('应该正确导入有效的CSV文件', () => {
      const csvContent = `员工编号,姓名,部门,手机号,线路名称,上车点
E001,张三,技术部,13800138001,1号线,公司大门
E002,李四,行政部,13800138002,2号线,科技园区`;

      const filePath = createTestFile('valid.csv', csvContent);
      const result = importer.importFile(filePath);

      expect(result.records.length).toBe(2);
      expect(result.records[0].employeeId).toBe('E001');
      expect(result.records[0].employeeName).toBe('张三');
      expect(result.records[0].phone).toBe('13800138001');
      expect(result.records[0].routeName).toBe('1号线');
    });

    it('应该支持不同的列名映射', () => {
      const csvContent = `工号,姓名,手机号,线路
E001,张三,13800138001,1号线`;

      const filePath = createTestFile('alt-columns.csv', csvContent);
      const result = importer.importFile(filePath);

      expect(result.records.length).toBe(1);
      expect(result.records[0].employeeId).toBe('E001');
    });

    it('应该处理可选列缺失的情况', () => {
      const csvContent = `员工编号,姓名,手机号,线路名称
E001,张三,13800138001,1号线`;

      const filePath = createTestFile('missing-optional.csv', csvContent);
      const result = importer.importFile(filePath);

      expect(result.records.length).toBe(1);
      expect(result.records[0].department).toBe('');
      expect(result.records[0].boardingPoint).toBe('');
    });
  });

  describe('缺列测试', () => {
    it('缺少员工编号列时应该抛出错误', () => {
      const csvContent = `姓名,手机号,线路名称
张三,13800138001,1号线`;

      const filePath = createTestFile('missing-employee-id.csv', csvContent);

      expect(() => importer.importFile(filePath)).toThrow(ColumnMappingError);
      expect(() => importer.importFile(filePath)).toThrow('缺少必要的列');
    });

    it('缺少姓名列时应该抛出错误', () => {
      const csvContent = `员工编号,手机号,线路名称
E001,13800138001,1号线`;

      const filePath = createTestFile('missing-name.csv', csvContent);

      expect(() => importer.importFile(filePath)).toThrow(ColumnMappingError);
    });

    it('缺少手机号列时应该抛出错误', () => {
      const csvContent = `员工编号,姓名,线路名称
E001,张三,1号线`;

      const filePath = createTestFile('missing-phone.csv', csvContent);

      expect(() => importer.importFile(filePath)).toThrow(ColumnMappingError);
    });

    it('缺少线路名称列时应该抛出错误', () => {
      const csvContent = `员工编号,姓名,手机号
E001,张三,13800138001`;

      const filePath = createTestFile('missing-route.csv', csvContent);

      expect(() => importer.importFile(filePath)).toThrow(ColumnMappingError);
    });
  });

  describe('空文件测试', () => {
    it('空文件应该抛出FileImportError', () => {
      const filePath = createTestFile('empty.csv', '');

      expect(() => importer.importFile(filePath)).toThrow(FileImportError);
      expect(() => importer.importFile(filePath)).toThrow('文件为空');
    });

    it('只有表头没有数据的文件应该正常导入但记录数为0', () => {
      const csvContent = `员工编号,姓名,手机号,线路名称`;

      const filePath = createTestFile('only-header.csv', csvContent);
      const result = importer.importFile(filePath);

      expect(result.records.length).toBe(0);
    });
  });

  describe('无效记录测试', () => {
    it('应该正确识别缺少必要信息的行', () => {
      const csvContent = `员工编号,姓名,手机号,线路名称
E001,张三,13800138001,1号线
,,,`;

      const filePath = createTestFile('invalid-rows.csv', csvContent);
      const result = importer.importFile(filePath);

      expect(result.records.length).toBe(1);
      expect(result.invalidRecords.length).toBeGreaterThan(0);
    });

    it('应该标记线路名称为空的记录为无效', () => {
      const csvContent = `员工编号,姓名,手机号,线路名称
E001,张三,13800138001,
E002,李四,13800138002,2号线`;

      const filePath = createTestFile('missing-route-value.csv', csvContent);
      const result = importer.importFile(filePath);

      expect(result.records.length).toBe(1);
      expect(result.invalidRecords.length).toBe(1);
      expect(result.invalidRecords[0].errors).toContain('线路名称不能为空');
    });
  });

  describe('编码测试', () => {
    it('应该支持UTF-8编码文件', () => {
      const csvContent = `员工编号,姓名,手机号,线路名称
E001,张三,13800138001,1号线`;

      const filePath = createTestFile('utf8.csv', csvContent);
      const result = importer.importFile(filePath, { encoding: 'UTF-8' });

      expect(result.records.length).toBe(1);
      expect(result.records[0].employeeName).toBe('张三');
    });

    it('应该支持GBK编码文件', () => {
      const csvContent = `员工编号,姓名,手机号,线路名称
E001,张三,13800138001,1号线`;

      const filePath = path.join(tempDir, 'gbk.csv');
      const gbkBuffer = iconv.encode(csvContent, 'gbk');
      fs.writeFileSync(filePath, gbkBuffer);

      const result = importer.importFile(filePath, { encoding: 'GBK' });

      expect(result.records.length).toBe(1);
      expect(result.records[0].employeeName).toBe('张三');
    });

    it('Auto编码应该能自动检测中文文件', () => {
      const csvContent = `员工编号,姓名,手机号,线路名称
E001,张三,13800138001,1号线`;

      const filePath = path.join(tempDir, 'auto-gbk.csv');
      const gbkBuffer = iconv.encode(csvContent, 'gbk');
      fs.writeFileSync(filePath, gbkBuffer);

      const result = importer.importFile(filePath, { encoding: 'Auto' });

      expect(result.records.length).toBe(1);
      expect(result.records[0].employeeName).toBe('张三');
    });
  });

  describe('批量导入测试', () => {
    it('应该能够导入多个文件', () => {
      const file1 = createTestFile('file1.csv', `员工编号,姓名,手机号,线路名称
E001,张三,13800138001,1号线`);
      const file2 = createTestFile('file2.csv', `员工编号,姓名,手机号,线路名称
E002,李四,13800138002,2号线`);

      const result = importer.importFiles([file1, file2]);

      expect(result.records.length).toBe(2);
      expect(result.fileResults.length).toBe(2);
      expect(result.fileResults.every(fr => fr.success)).toBe(true);
    });

    it('部分文件失败时应该继续处理其他文件', () => {
      const validFile = createTestFile('valid.csv', `员工编号,姓名,手机号,线路名称
E001,张三,13800138001,1号线`);
      const invalidFile = createTestFile('invalid.csv', `姓名,手机号
张三,13800138001`);

      const result = importer.importFiles([validFile, invalidFile]);

      expect(result.records.length).toBe(1);
      expect(result.fileResults.length).toBe(2);
      expect(result.fileResults[0].success).toBe(true);
      expect(result.fileResults[1].success).toBe(false);
      expect(result.fileResults[1].error).toBeDefined();
    });

    it('应该正确处理不存在的文件', () => {
      const validFile = createTestFile('valid.csv', `员工编号,姓名,手机号,线路名称
E001,张三,13800138001,1号线`);
      const nonExistentFile = path.join(tempDir, 'nonexistent.csv');

      const result = importer.importFiles([validFile, nonExistentFile]);

      expect(result.records.length).toBe(1);
      expect(result.fileResults.length).toBe(2);
      expect(result.fileResults[0].success).toBe(true);
      expect(result.fileResults[1].success).toBe(false);
    });
  });

  describe('文件不存在测试', () => {
    it('导入不存在的文件应该抛出FileImportError', () => {
      const nonExistentFile = path.join(tempDir, 'nonexistent.csv');

      expect(() => importer.importFile(nonExistentFile)).toThrow(FileImportError);
      expect(() => importer.importFile(nonExistentFile)).toThrow('文件不存在');
    });
  });
});
