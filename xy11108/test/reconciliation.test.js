const fs = require('fs');
const path = require('path');
const tmp = require('tmp');
const {
  validateColumns,
  normalizeUnit,
  generateRowKey,
  isGiftRow,
  sortRows,
  processSingleFile,
  processFiles
} = require('../src/reconciliation');

describe('花店配送花材采购对账 - 核心功能', () => {
  describe('列验证', () => {
    test('检测缺少的必需列', () => {
      const headers = ['材料编码', '材料名称', '采购数量'];
      const missing = validateColumns(headers);
      expect(missing).toContain('采购单位');
      expect(missing).toContain('单价');
      expect(missing).toContain('金额');
      expect(missing).toContain('供应商');
      expect(missing).toContain('采购日期');
    });

    test('所有列都存在时返回空数组', () => {
      const headers = ['材料编码', '材料名称', '采购数量', '采购单位', '单价', '金额', '供应商', '采购日期'];
      const missing = validateColumns(headers);
      expect(missing).toEqual([]);
    });
  });

  describe('单位规范化', () => {
    test('斤单位保持不变', () => {
      const result = normalizeUnit('斤', '5');
      expect(result.unit).toBe('斤');
      expect(result.quantity).toBe(5);
    });

    test('jin拼音转换为斤', () => {
      const result = normalizeUnit('jin', '3');
      expect(result.unit).toBe('斤');
      expect(result.quantity).toBe(3);
    });

    test('支单位保持不变', () => {
      const result = normalizeUnit('支', '50');
      expect(result.unit).toBe('支');
      expect(result.quantity).toBe(50);
    });

    test('枝同音字转换为支', () => {
      const result = normalizeUnit('枝', '30');
      expect(result.unit).toBe('支');
      expect(result.quantity).toBe(30);
    });

    test('zhi拼音转换为支', () => {
      const result = normalizeUnit('zhi', '20');
      expect(result.unit).toBe('支');
      expect(result.quantity).toBe(20);
    });

    test('束单位保持不变', () => {
      const result = normalizeUnit('束', '10');
      expect(result.unit).toBe('束');
      expect(result.quantity).toBe(10);
    });

    test('盆单位保持不变', () => {
      const result = normalizeUnit('盆', '5');
      expect(result.unit).toBe('盆');
      expect(result.quantity).toBe(5);
    });
  });

  describe('行键生成', () => {
    test('基于编码、名称、日期、供应商生成唯一键', () => {
      const row = {
        '材料编码': 'F001',
        '材料名称': '红玫瑰',
        '采购日期': '2024-05-01',
        '供应商': '昆明花卉基地'
      };
      const key = generateRowKey(row);
      expect(key).toBe('F001-红玫瑰-2024-05-01-昆明花卉基地');
    });

    test('空字段生成的键也有效', () => {
      const row = {
        '材料编码': '',
        '材料名称': '',
        '采购日期': '',
        '供应商': ''
      };
      const key = generateRowKey(row);
      expect(typeof key).toBe('string');
    });
  });

  describe('赠品行识别', () => {
    test('识别包含"赠品"的行', () => {
      const row = { '材料名称': '赠品-包装纸', '金额': '10' };
      expect(isGiftRow(row)).toBe(true);
    });

    test('识别包含"赠送"的行', () => {
      const row = { '材料名称': '赠送-丝带', '金额': '5' };
      expect(isGiftRow(row)).toBe(true);
    });

    test('识别金额为0的行', () => {
      const row = { '材料名称': '普通花材', '金额': '0' };
      expect(isGiftRow(row)).toBe(true);
    });

    test('正常行不被识别为赠品', () => {
      const row = { '材料名称': '红玫瑰', '金额': '125' };
      expect(isGiftRow(row)).toBe(false);
    });
  });

  describe('结果排序', () => {
    test('按采购日期升序排序', () => {
      const rows = [
        { '采购日期': '2024-05-02', '材料编码': 'F001', '材料名称': '红玫瑰' },
        { '采购日期': '2024-05-01', '材料编码': 'F001', '材料名称': '红玫瑰' }
      ];
      const sorted = sortRows(rows);
      expect(sorted[0]['采购日期']).toBe('2024-05-01');
      expect(sorted[1]['采购日期']).toBe('2024-05-02');
    });

    test('日期相同按材料编码排序', () => {
      const rows = [
        { '采购日期': '2024-05-01', '材料编码': 'F002', '材料名称': '白玫瑰' },
        { '采购日期': '2024-05-01', '材料编码': 'F001', '材料名称': '红玫瑰' }
      ];
      const sorted = sortRows(rows);
      expect(sorted[0]['材料编码']).toBe('F001');
      expect(sorted[1]['材料编码']).toBe('F002');
    });

    test('日期和编码相同按材料名称排序', () => {
      const rows = [
        { '采购日期': '2024-05-01', '材料编码': 'F001', '材料名称': '白玫瑰' },
        { '采购日期': '2024-05-01', '材料编码': 'F001', '材料名称': '红玫瑰' }
      ];
      const sorted = sortRows(rows);
      expect(sorted[0]['材料名称']).toBe('白玫瑰');
      expect(sorted[1]['材料名称']).toBe('红玫瑰');
    });
  });
});

describe('花店配送花材采购对账 - 文件处理', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = tmp.dirSync({ unsafeCleanup: true });
  });

  afterEach(() => {
    tmpDir.removeCallback();
  });

  test('处理空文件', async () => {
    const emptyFile = path.join(tmpDir.name, 'empty.csv');
    fs.writeFileSync(emptyFile, '');

    const result = await processSingleFile(emptyFile);
    expect(result.success).toBe(true);
    expect(result.data).toEqual([]);
    expect(result.logs.some(log => log.includes('文件为空'))).toBe(true);
  });

  test('处理只有表头无数据的文件', async () => {
    const noDataFile = path.join(tmpDir.name, 'no_data.csv');
    fs.writeFileSync(noDataFile, '材料编码,材料名称,采购数量,采购单位,单价,金额,供应商,采购日期\n');

    const result = await processSingleFile(noDataFile);
    expect(result.success).toBe(true);
    expect(result.data).toEqual([]);
    expect(result.logs.some(log => log.includes('文件无数据行'))).toBe(true);
  });

  test('检测并跳过重复行', async () => {
    const duplicateFile = path.join(tmpDir.name, 'duplicate.csv');
    fs.writeFileSync(duplicateFile, `材料编码,材料名称,采购数量,采购单位,单价,金额,供应商,采购日期
F001,红玫瑰,50,支,2.5,125,昆明花卉基地,2024-05-01
F001,红玫瑰,50,支,2.5,125,昆明花卉基地,2024-05-01
F002,白玫瑰,30,支,2.8,84,昆明花卉基地,2024-05-01`);

    const result = await processSingleFile(duplicateFile);
    expect(result.success).toBe(true);
    expect(result.data.length).toBe(2);
    expect(result.warnings.some(w => w.includes('发现重复行'))).toBe(true);
  });

  test('检测缺少的列并发出警告', async () => {
    const missingColFile = path.join(tmpDir.name, 'missing_col.csv');
    fs.writeFileSync(missingColFile, `材料编码,材料名称,采购数量,单价,金额,供应商
F001,红玫瑰,50,2.5,125,昆明花卉基地`);

    const result = await processSingleFile(missingColFile);
    expect(result.success).toBe(true);
    expect(result.warnings.some(w => w.includes('文件缺少列'))).toBe(true);
    expect(result.warnings.some(w => w.includes('采购单位'))).toBe(true);
    expect(result.warnings.some(w => w.includes('采购日期'))).toBe(true);
  });

  test('规范化单位并记录', async () => {
    const unitFile = path.join(tmpDir.name, 'unit_test.csv');
    fs.writeFileSync(unitFile, `材料编码,材料名称,采购数量,采购单位,单价,金额,供应商,采购日期
F005,尤加利叶,3,jin,15,45,云南绿叶供应商,2024-05-02
F009,百合,15,枝,8,120,昆明花卉基地,2024-05-01`);

    const result = await processSingleFile(unitFile);
    expect(result.success).toBe(true);
    expect(result.warnings.some(w => w.includes('单位规范化'))).toBe(true);
    expect(result.data[0]['采购单位']).toBe('斤');
    expect(result.data[1]['采购单位']).toBe('支');
  });

  test('识别赠品行并记录', async () => {
    const giftFile = path.join(tmpDir.name, 'gift_test.csv');
    fs.writeFileSync(giftFile, `材料编码,材料名称,采购数量,采购单位,单价,金额,供应商,采购日期
F008,赠品-包装纸,10,张,0,0,包装材料店,2024-05-01
F013,赠送-丝带,1,卷,0,0,包装材料店,2024-05-02
F001,红玫瑰,50,支,2.5,125,昆明花卉基地,2024-05-01`);

    const result = await processSingleFile(giftFile);
    expect(result.success).toBe(true);
    expect(result.warnings.filter(w => w.includes('发现赠品行')).length).toBe(2);
  });
});

describe('花店配送花材采购对账 - 多文件和容错处理', () => {
  let tmpDir;
  let outputDir;

  beforeEach(() => {
    tmpDir = tmp.dirSync({ unsafeCleanup: true });
    outputDir = path.join(tmpDir.name, 'output');
  });

  afterEach(() => {
    tmpDir.removeCallback();
  });

  test('处理多个文件并合并结果', async () => {
    const file1 = path.join(tmpDir.name, 'file1.csv');
    const file2 = path.join(tmpDir.name, 'file2.csv');

    fs.writeFileSync(file1, `材料编码,材料名称,采购数量,采购单位,单价,金额,供应商,采购日期
F001,红玫瑰,50,支,2.5,125,昆明花卉基地,2024-05-01`);

    fs.writeFileSync(file2, `材料编码,材料名称,采购数量,采购单位,单价,金额,供应商,采购日期
F002,白玫瑰,30,支,2.8,84,昆明花卉基地,2024-05-02`);

    const result = await processFiles([file1, file2], outputDir);
    expect(result.totalRecords).toBe(2);
    expect(result.failedFiles.length).toBe(0);
    expect(fs.existsSync(result.outputPath)).toBe(true);
  });

  test('部分文件失败后继续处理剩余文件', async () => {
    const goodFile = path.join(tmpDir.name, 'good.csv');
    const nonExistentFile = path.join(tmpDir.name, 'nonexistent.csv');
    const anotherGoodFile = path.join(tmpDir.name, 'another_good.csv');

    fs.writeFileSync(goodFile, `材料编码,材料名称,采购数量,采购单位,单价,金额,供应商,采购日期
F001,红玫瑰,50,支,2.5,125,昆明花卉基地,2024-05-01`);

    fs.writeFileSync(anotherGoodFile, `材料编码,材料名称,采购数量,采购单位,单价,金额,供应商,采购日期
F003,康乃馨,40,支,1.5,60,昆明花卉基地,2024-05-01`);

    const result = await processFiles([goodFile, nonExistentFile, anotherGoodFile], outputDir);
    
    expect(result.failedFiles.length).toBe(1);
    expect(result.failedFiles).toContain('nonexistent.csv');
    expect(result.totalRecords).toBe(2);
    expect(result.logs.some(log => log.includes('继续处理剩余文件'))).toBe(true);
  });

  test('输出结果按固定规则排序便于diff', async () => {
    const unsortedFile = path.join(tmpDir.name, 'unsorted.csv');
    fs.writeFileSync(unsortedFile, `材料编码,材料名称,采购数量,采购单位,单价,金额,供应商,采购日期
F002,白玫瑰,30,支,2.8,84,昆明花卉基地,2024-05-02
F001,红玫瑰,50,支,2.5,125,昆明花卉基地,2024-05-01
F003,康乃馨,40,支,1.5,60,昆明花卉基地,2024-05-01`);

    const result = await processFiles([unsortedFile], outputDir);
    
    const outputContent = fs.readFileSync(result.outputPath, 'utf8');
    const lines = outputContent.split('\n').filter(l => l.trim());
    
    expect(lines[1]).toContain('2024-05-01');
    expect(lines[1]).toContain('F001');
    expect(lines[2]).toContain('2024-05-01');
    expect(lines[2]).toContain('F003');
    expect(lines[3]).toContain('2024-05-02');
    expect(lines[3]).toContain('F002');
  });

  test('可复跑输出 - 相同输入产生相同输出', async () => {
    const testFile = path.join(tmpDir.name, 'test.csv');
    fs.writeFileSync(testFile, `材料编码,材料名称,采购数量,采购单位,单价,金额,供应商,采购日期
F001,红玫瑰,50,支,2.5,125,昆明花卉基地,2024-05-01
F002,白玫瑰,30,支,2.8,84,昆明花卉基地,2024-05-01`);

    const outputDir1 = path.join(tmpDir.name, 'output1');
    const outputDir2 = path.join(tmpDir.name, 'output2');

    const result1 = await processFiles([testFile], outputDir1);
    const result2 = await processFiles([testFile], outputDir2);

    const content1 = fs.readFileSync(result1.outputPath, 'utf8');
    const content2 = fs.readFileSync(result2.outputPath, 'utf8');

    expect(content1).toBe(content2);
  });

  test('包含来源文件信息便于追溯', async () => {
    const fileA = path.join(tmpDir.name, 'supplier_a.csv');
    const fileB = path.join(tmpDir.name, 'supplier_b.csv');

    fs.writeFileSync(fileA, `材料编码,材料名称,采购数量,采购单位,单价,金额,供应商,采购日期
F001,红玫瑰,50,支,2.5,125,昆明花卉基地,2024-05-01`);

    fs.writeFileSync(fileB, `材料编码,材料名称,采购数量,采购单位,单价,金额,供应商,采购日期
F001,红玫瑰,40,支,2.6,104,斗南花卉市场,2024-05-01`);

    const result = await processFiles([fileA, fileB], outputDir);
    const outputContent = fs.readFileSync(result.outputPath, 'utf8');

    expect(outputContent).toContain('supplier_a.csv');
    expect(outputContent).toContain('supplier_b.csv');
  });
});
