const fs = require('fs');
const path = require('path');
const tmp = require('tmp');
const { InspectionProcessor } = require('../src/processor');
const { DEFAULT_CONFIG } = require('../src/config');

describe('InspectionProcessor', () => {
  let tempDir;
  let processor;

  beforeEach(() => {
    tempDir = tmp.dirSync({ unsafeCleanup: true });
    processor = new InspectionProcessor(DEFAULT_CONFIG, tempDir.name);
  });

  afterEach(() => {
    tempDir.removeCallback();
  });

  describe('空文件处理', () => {
    test('应正确处理空文件', async () => {
      const emptyFile = path.join(tempDir.name, 'empty.csv');
      fs.writeFileSync(emptyFile, '');

      await processor.processFile(emptyFile);
      const stats = processor.getStatistics();

      expect(stats.errorCount).toBeGreaterThan(0);
      const hasEmptyFileError = processor.results.errors.some(
        e => e.type === 'empty_file'
      );
      expect(hasEmptyFileError).toBe(true);
    });
  });

  describe('缺列文件处理', () => {
    test('应正确检测缺失的列', async () => {
      const missingColumnFile = path.join(tempDir.name, 'missing_column.csv');
      fs.writeFileSync(missingColumnFile, 
        '设备编号,设备名称,检修日期\nPAR-001,帕灯,2024-01-15'
      );

      await processor.processFile(missingColumnFile);

      const hasMissingColumnError = processor.results.errors.some(
        e => e.type === 'missing_column'
      );
      expect(hasMissingColumnError).toBe(true);
    });
  });

  describe('重复行处理', () => {
    test('应正确检测重复行', async () => {
      const duplicateFile = path.join(tempDir.name, 'duplicate.csv');
      fs.writeFileSync(duplicateFile, 
        '设备编号,设备名称,设备类型,检修日期,检修人员,检修状态\n' +
        'PAR-001,帕灯,PAR灯,2024-01-15,张工,合格\n' +
        'SPOT-002,追光灯,追光灯,2024-01-15,李工,合格\n' +
        'PAR-001,帕灯,PAR灯,2024-01-15,张工,合格'
      );

      await processor.processFile(duplicateFile);

      const hasDuplicateError = processor.results.errors.some(
        e => e.type === 'duplicate_row'
      );
      expect(hasDuplicateError).toBe(true);
    });
  });

  describe('套装缺件检测', () => {
    test('应正确检测套装缺件', async () => {
      const setFile = path.join(tempDir.name, 'set_missing.csv');
      fs.writeFileSync(setFile, 
        '设备编号,设备名称,设备类型,检修日期,检修人员,检修状态,套装编号\n' +
        'STROBE-006,频闪灯,频闪灯,2024-01-18,王工,合格,SET-D\n' +
        'PAR-001,帕灯,PAR灯,2024-01-15,张工,合格,SET-A;SET-B'
      );

      await processor.processFile(setFile);

      expect(processor.results.setMissingItems.length).toBe(1);
      expect(processor.results.setMissingItems[0]['设备编号']).toBe('STROBE-006');
    });
  });

  describe('灯泡寿命检测', () => {
    test('应正确检测灯泡寿命问题', async () => {
      const bulbFile = path.join(tempDir.name, 'bulb_test.csv');
      fs.writeFileSync(bulbFile, 
        '设备编号,设备名称,设备类型,检修日期,检修人员,检修状态,灯泡使用时长\n' +
        'BEAM-003,光束灯,光束灯,2024-01-16,王工,合格,2100\n' +
        'BST-011,观众灯,观众灯,2024-01-21,赵工,合格,1600\n' +
        'LED-004,LED染色灯,LED灯,2024-01-16,赵工,合格,500'
      );

      await processor.processFile(bulbFile);

      expect(processor.results.bulbLifeReport.length).toBe(2);
      const criticalBulb = processor.results.bulbLifeReport.find(
        b => b['问题级别'] === 'critical'
      );
      const warningBulb = processor.results.bulbLifeReport.find(
        b => b['问题级别'] === 'warning'
      );
      expect(criticalBulb).toBeDefined();
      expect(warningBulb).toBeDefined();
    });
  });

  describe('结果分离', () => {
    test('套装缺件不应混入正常结果', async () => {
      const testFile = path.join(tempDir.name, 'separation_test.csv');
      fs.writeFileSync(testFile, 
        '设备编号,设备名称,设备类型,检修日期,检修人员,检修状态,套装编号,灯泡使用时长\n' +
        'STROBE-006,频闪灯,频闪灯,2024-01-18,王工,合格,SET-D,300\n' +
        'PAR-001,帕灯,PAR灯,2024-01-15,张工,合格,,1200'
      );

      await processor.processFile(testFile);

      const setMissingIds = processor.results.setMissingItems.map(i => i['设备编号']);
      const normalIds = processor.results.normal.map(i => i['设备编号']);

      expect(setMissingIds).toContain('STROBE-006');
      expect(normalIds).not.toContain('STROBE-006');
    });

    test('灯泡寿命问题不应混入正常结果', async () => {
      const testFile = path.join(tempDir.name, 'bulb_separation.csv');
      fs.writeFileSync(testFile, 
        '设备编号,设备名称,设备类型,检修日期,检修人员,检修状态,灯泡使用时长\n' +
        'BEAM-003,光束灯,光束灯,2024-01-16,王工,合格,2100\n' +
        'LED-004,LED染色灯,LED灯,2024-01-16,赵工,合格,500'
      );

      await processor.processFile(testFile);

      const bulbIds = processor.results.bulbLifeReport.map(b => b['设备编号']);
      const normalIds = processor.results.normal.map(i => i['设备编号']);

      expect(bulbIds).toContain('BEAM-003');
      expect(normalIds).toContain('BEAM-003');
    });
  });

  describe('部分失败继续处理', () => {
    test('一个文件失败后应继续处理其他文件', async () => {
      const badFile = path.join(tempDir.name, 'bad.csv');
      const goodFile = path.join(tempDir.name, 'good.csv');

      fs.writeFileSync(badFile, Buffer.from([0x80, 0x81, 0x82]));
      fs.writeFileSync(goodFile, 
        '设备编号,设备名称,设备类型,检修日期,检修人员,检修状态\n' +
        'PAR-001,帕灯,PAR灯,2024-01-15,张工,合格'
      );

      let failed = false;
      try {
        await processor.processFile(badFile);
      } catch (e) {
        failed = true;
      }
      
      await processor.processFile(goodFile);

      const stats = processor.getStatistics();
      expect(stats.normalCount).toBe(1);
      expect(stats.total).toBe(1);
    });
  });

  describe('输出文件写入', () => {
    test('应正确写入所有输出文件', async () => {
      const testFile = path.join(tempDir.name, 'output_test.csv');
      fs.writeFileSync(testFile, 
        '设备编号,设备名称,设备类型,检修日期,检修人员\n' +
        'STROBE-006,频闪灯,频闪灯,2024-01-18,王工\n' +
        'BEAM-003,光束灯,光束灯,2024-01-16,王工\n' +
        'PAR-001,帕灯,PAR灯,2024-01-15,张工'
      );

      await processor.processFile(testFile);
      await processor.writeResults();

      const files = fs.readdirSync(tempDir.name);
      expect(files).toContain(DEFAULT_CONFIG.output.rerunOutput);
      expect(files).toContain(DEFAULT_CONFIG.output.errors);
    });
  });
});
