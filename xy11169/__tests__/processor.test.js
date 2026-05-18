const fs = require('fs');
const path = require('path');
const iconv = require('iconv-lite');
const PhoneReportProcessor = require('../src/processor');

describe('PhoneReportProcessor', () => {
  let processor;
  const testOutputDir = path.join(__dirname, '../test_output');

  beforeEach(() => {
    processor = new PhoneReportProcessor({ outputDir: testOutputDir });
  });

  afterEach(() => {
    if (fs.existsSync(testOutputDir)) {
      fs.rmSync(testOutputDir, { recursive: true, force: true });
    }
  });

  describe('正常数据处理', () => {
    it('应该正确处理正常的CSV文件', async () => {
      const testFile = path.join(__dirname, '../samples/normal_report.csv');
      const results = await processor.processFile(testFile);
      
      expect(results.length).toBe(5);
      expect(processor.errors.length).toBe(0);
      expect(processor.warnings.length).toBe(0);
    });

    it('第一条记录应该包含正确的手机信息', async () => {
      const testFile = path.join(__dirname, '../samples/normal_report.csv');
      const results = await processor.processFile(testFile);
      
      expect(results[0]['品牌型号']).toBe('iPhone 12');
      expect(results[0]['回收估价']).toBe('2800');
    });
  });

  describe('缺列检测', () => {
    it('应该检测到缺少的列', async () => {
      const testFile = path.join(__dirname, '../samples/missing_columns.csv');
      await processor.processFile(testFile);
      
      const missingColumnError = processor.errors.find(e => 
        e.message.includes('缺少必需列')
      );
      
      expect(missingColumnError).toBeDefined();
      expect(missingColumnError.lineNumber).toBe(1);
      expect(missingColumnError.file).toBe('missing_columns.csv');
    });

    it('错误信息应该包含具体缺失的列名', async () => {
      const testFile = path.join(__dirname, '../samples/missing_columns.csv');
      await processor.processFile(testFile);
      
      const missingColumnError = processor.errors.find(e => 
        e.message.includes('缺少必需列')
      );
      
      expect(missingColumnError.message).toContain('屏幕状态');
      expect(missingColumnError.message).toContain('回收估价');
    });
  });

  describe('重复行检测', () => {
    it('应该检测到重复的序列号', async () => {
      const testFile = path.join(__dirname, '../samples/dirty_report.csv');
      await processor.processFile(testFile);
      
      const duplicateWarning = processor.warnings.find(w => 
        w.message.includes('序列号重复')
      );
      
      expect(duplicateWarning).toBeDefined();
      expect(duplicateWarning.message).toContain('SN2024050006');
    });

    it('重复序列号不应该导致整个任务失败', async () => {
      const testFile = path.join(__dirname, '../samples/dirty_report.csv');
      
      await expect(processor.processFile(testFile)).resolves.not.toThrow();
      expect(processor.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('屏幕暗病检测', () => {
    it('应该检测到屏幕暗病警告', async () => {
      const testFile = path.join(__dirname, '../samples/dirty_report.csv');
      await processor.processFile(testFile);
      
      const screenIssueWarnings = processor.warnings.filter(w => 
        w.message.includes('屏幕存在暗病')
      );
      
      expect(screenIssueWarnings.length).toBe(2);
    });

    it('屏幕暗病只产生警告不产生错误', async () => {
      const testFile = path.join(__dirname, '../samples/dirty_report.csv');
      await processor.processFile(testFile);
      
      const screenIssueErrors = processor.errors.filter(e => 
        e.message.includes('暗病')
      );
      
      expect(screenIssueErrors.length).toBe(0);
    });
  });

  describe('无效数据检测', () => {
    it('应该检测到空序列号', async () => {
      const testFile = path.join(__dirname, '../samples/dirty_report.csv');
      await processor.processFile(testFile);
      
      const emptySerialError = processor.errors.find(e => 
        e.message.includes('序列号为空')
      );
      
      expect(emptySerialError).toBeDefined();
    });

    it('应该检测到无效的回收估价', async () => {
      const testFile = path.join(__dirname, '../samples/dirty_report.csv');
      await processor.processFile(testFile);
      
      const invalidPriceErrors = processor.errors.filter(e => 
        e.message.includes('回收估价无效')
      );
      
      expect(invalidPriceErrors.length).toBeGreaterThan(0);
    });
  });

  describe('编码异常处理', () => {
    it('应该正确检测和处理GBK编码文件', async () => {
      const gbkContent = `检测编号,序列号,品牌型号,检测日期,外观成色,屏幕状态,电池健康,功能检测,回收估价
JC20240504001,SN2024050013,华为Mate40,2024-05-04,95新,正常,90%,全部正常,3500
`;
      const gbkFile = path.join(__dirname, '../test_gbk.csv');
      fs.writeFileSync(gbkFile, iconv.encode(gbkContent, 'gbk'));
      
      const encoding = await processor.detectEncoding(gbkFile);
      expect(['gbk', 'gb2312']).toContain(encoding);
      
      const results = await processor.processFile(gbkFile);
      expect(results.length).toBe(1);
      expect(results[0]['品牌型号']).toBe('华为Mate40');
      
      fs.unlinkSync(gbkFile);
    });
  });

  describe('部分失败处理', () => {
    it('文件不存在时应该抛出错误', async () => {
      const nonExistentFile = path.join(__dirname, '../nonexistent.csv');
      
      await expect(processor.processFile(nonExistentFile)).rejects.toThrow('输入文件不存在');
    });

    it('部分文件失败时不应该影响其他文件处理', async () => {
      const normalFile = path.join(__dirname, '../samples/normal_report.csv');
      const nonExistentFile = path.join(__dirname, '../nonexistent.csv');
      
      await expect(processor.processFiles([normalFile, nonExistentFile])).rejects.toThrow();
      
      expect(processor.processedRecords.length).toBe(5);
    });
  });

  describe('异常摘要', () => {
    it('错误摘要应该包含文件名和行号', async () => {
      const testFile = path.join(__dirname, '../samples/dirty_report.csv');
      await processor.processFile(testFile);
      
      processor.errors.forEach(error => {
        expect(error).toHaveProperty('file');
        expect(error).toHaveProperty('lineNumber');
        expect(error).toHaveProperty('message');
        expect(typeof error.lineNumber).toBe('number');
      });
    });

    it('应该能够生成JSON摘要文件', async () => {
      const testFile = path.join(__dirname, '../samples/dirty_report.csv');
      await processor.processFile(testFile);
      
      const summaryPath = await processor.writeSummary('test_summary.json');
      
      expect(fs.existsSync(summaryPath)).toBe(true);
      
      const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf-8'));
      expect(summary).toHaveProperty('totalRecords');
      expect(summary).toHaveProperty('errorCount');
      expect(summary).toHaveProperty('errors');
      expect(summary.errors[0]).toHaveProperty('file');
      expect(summary.errors[0]).toHaveProperty('lineNumber');
    });
  });

  describe('输出功能', () => {
    it('应该能够生成清洗后的CSV文件', async () => {
      const testFile = path.join(__dirname, '../samples/normal_report.csv');
      await processor.processFile(testFile);
      
      const outputPath = await processor.writeOutput('test_output.csv');
      
      expect(fs.existsSync(outputPath)).toBe(true);
    });

    it('空数据不应该生成输出文件', async () => {
      const outputPath = await processor.writeOutput('empty.csv');
      
      expect(outputPath).toBeNull();
    });
  });
});
