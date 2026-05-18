const { checkMissingColumns, findDuplicateRows, validateRow, validateBulbLife } = require('../src/validator');
const { DEFAULT_CONFIG } = require('../src/config');

describe('validator', () => {
  describe('checkMissingColumns', () => {
    test('应正确检测缺失的列', () => {
      const headers = ['设备编号', '设备名称', '检修日期'];
      const result = checkMissingColumns(headers, DEFAULT_CONFIG.requiredColumns);
      
      expect(result.hasMissing).toBe(true);
      expect(result.missingColumns).toContain('设备类型');
      expect(result.missingColumns).toContain('检修人员');
      expect(result.missingColumns).toContain('检修状态');
    });

    test('所有列都存在时应返回无缺失', () => {
      const headers = DEFAULT_CONFIG.requiredColumns;
      const result = checkMissingColumns(headers, DEFAULT_CONFIG.requiredColumns);
      
      expect(result.hasMissing).toBe(false);
      expect(result.missingColumns).toEqual([]);
    });
  });

  describe('findDuplicateRows', () => {
    test('应正确检测重复行', () => {
      const rows = [
        { '设备编号': 'PAR-001', '设备名称': '帕灯' },
        { '设备编号': 'SPOT-002', '设备名称': '追光灯' },
        { '设备编号': 'PAR-001', '设备名称': '帕灯' }
      ];
      
      const result = findDuplicateRows(rows, DEFAULT_CONFIG.validation.duplicateCheckColumns);
      
      expect(result.hasDuplicates).toBe(true);
      expect(result.duplicates.length).toBe(1);
      expect(result.duplicates[0].rowIndex).toBe(4);
      expect(result.duplicates[0].duplicateWith).toBe(2);
    });

    test('无重复行时应返回空', () => {
      const rows = [
        { '设备编号': 'PAR-001', '设备名称': '帕灯' },
        { '设备编号': 'SPOT-002', '设备名称': '追光灯' }
      ];
      
      const result = findDuplicateRows(rows, DEFAULT_CONFIG.validation.duplicateCheckColumns);
      
      expect(result.hasDuplicates).toBe(false);
      expect(result.duplicates).toEqual([]);
    });
  });

  describe('validateRow', () => {
    test('应正确检测缺失的值', () => {
      const row = {
        '设备编号': 'PAR-001',
        '设备名称': '帕灯',
        '设备类型': '',
        '检修日期': '2024-01-15',
        '检修人员': '张工',
        '检修状态': '合格'
      };
      
      const result = validateRow(row, 2, DEFAULT_CONFIG);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBe(1);
      expect(result.errors[0].column).toBe('设备类型');
    });

    test('所有值都存在时应返回有效', () => {
      const row = {
        '设备编号': 'PAR-001',
        '设备名称': '帕灯',
        '设备类型': 'PAR灯',
        '检修日期': '2024-01-15',
        '检修人员': '张工',
        '检修状态': '合格'
      };
      
      const result = validateRow(row, 2, DEFAULT_CONFIG);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });
  });

  describe('validateBulbLife', () => {
    test('应检测到需要更换的灯泡', () => {
      const row = { '灯泡使用时长': '2100' };
      const result = validateBulbLife(row, DEFAULT_CONFIG);
      
      expect(result.hasIssues).toBe(true);
      expect(result.issues[0].severity).toBe('critical');
      expect(result.issues[0].type).toBe('bulb_replace');
    });

    test('应检测到需要警告的灯泡', () => {
      const row = { '灯泡使用时长': '1600' };
      const result = validateBulbLife(row, DEFAULT_CONFIG);
      
      expect(result.hasIssues).toBe(true);
      expect(result.issues[0].severity).toBe('warning');
      expect(result.issues[0].type).toBe('bulb_warning');
    });

    test('正常使用的灯泡应无问题', () => {
      const row = { '灯泡使用时长': '500' };
      const result = validateBulbLife(row, DEFAULT_CONFIG);
      
      expect(result.hasIssues).toBe(false);
      expect(result.issues).toEqual([]);
    });
  });
});
