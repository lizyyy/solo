const path = require('path');
const fs = require('fs-extra');
const Parser = require('../src/parser');

describe('Parser', () => {
  let parser;
  let testDir;

  beforeEach(() => {
    parser = new Parser();
    testDir = path.join(__dirname, 'test-temp');
  });

  afterEach(async () => {
    if (await fs.pathExists(testDir)) {
      await fs.remove(testDir);
    }
  });

  describe('parseCSV', () => {
    it('应正确解析CSV文件', async () => {
      await fs.ensureDir(testDir);
      const csvPath = path.join(testDir, 'test.csv');
      
      const csvContent = [
        '名称,场景,Cue,负责人',
        '王座,第一幕,Cue01,张三',
        '宝剑,第一幕,Cue02,李四'
      ].join('\n');
      
      await fs.writeFile(csvPath, csvContent);
      
      const result = await parser.parseCSV(csvPath);
      
      expect(result.errors.length).toBe(0);
      expect(result.data.length).toBe(1);
      expect(result.data[0].rows.length).toBe(2);
      expect(result.data[0].rows[0].name).toBe('王座');
    });
  });

  describe('parseJSON', () => {
    it('应正确解析数组格式的JSON', async () => {
      await fs.ensureDir(testDir);
      const jsonPath = path.join(testDir, 'test.json');
      
      const jsonData = [
        { cueNumber: 1, scene: '第一幕', description: '开场' },
        { cueNumber: 2, scene: '第一幕', description: '聚光' }
      ];
      
      await fs.writeJson(jsonPath, jsonData);
      
      const result = await parser.parseJSON(jsonPath);
      
      expect(result.errors.length).toBe(0);
      expect(result.data.length).toBe(1);
      expect(result.data[0].rows.length).toBe(2);
    });

    it('应正确解析包含cues字段的JSON', async () => {
      await fs.ensureDir(testDir);
      const jsonPath = path.join(testDir, 'test.json');
      
      const jsonData = {
        cues: [
          { cueNumber: 1, scene: '第一幕' },
          { cueNumber: 2, scene: '第一幕' }
        ]
      };
      
      await fs.writeJson(jsonPath, jsonData);
      
      const result = await parser.parseJSON(jsonPath);
      
      expect(result.errors.length).toBe(0);
      expect(result.data[0].rows.length).toBe(2);
    });

    it('应报告无效JSON的错误', async () => {
      await fs.ensureDir(testDir);
      const jsonPath = path.join(testDir, 'test.json');
      
      await fs.writeFile(jsonPath, 'invalid json {{{');
      
      const result = await parser.parseJSON(jsonPath);
      
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('_normalizeRow', () => {
    it('应标准化字段名', () => {
      const row = {
        '名称': '王座',
        '场景': '第一幕',
        '负责人': '张三'
      };
      
      const normalized = parser._normalizeRow(row, 'test');
      
      expect(normalized.name).toBe('王座');
      expect(normalized.scene).toBe('第一幕');
      expect(normalized.responsible).toBe('张三');
    });

    it('应同时保留原始字段名', () => {
      const row = {
        '名称': '王座'
      };
      
      const normalized = parser._normalizeRow(row, 'test');
      
      expect(normalized.name).toBe('王座');
      expect(normalized['名称']).toBe('王座');
    });
  });

  describe('_mapField', () => {
    it('应映射中文字段名到标准字段', () => {
      expect(parser._mapField('名称')).toBe('name');
      expect(parser._mapField('场景')).toBe('scene');
      expect(parser._mapField('负责人')).toBe('responsible');
      expect(parser._mapField('优先级')).toBe('priority');
    });

    it('应映射英文字段名到标准字段', () => {
      expect(parser._mapField('name')).toBe('name');
      expect(parser._mapField('scene')).toBe('scene');
      expect(parser._mapField('responsible')).toBe('responsible');
    });

    it('应返回null对于未映射的字段', () => {
      expect(parser._mapField('unknown_field')).toBeNull();
    });
  });

  describe('_parseTimeFields', () => {
    it('应解析MM:SS格式的时间', () => {
      const row = { time: '3:30' };
      parser._parseTimeFields(row);
      expect(row.time_seconds).toBe(210);
    });

    it('应解析数字格式的时间', () => {
      const row = { time: '120' };
      parser._parseTimeFields(row);
      expect(row.time_seconds).toBe(120);
    });
  });

  describe('parseText', () => {
    it('应解析Markdown格式的文本', async () => {
      await fs.ensureDir(testDir);
      const mdPath = path.join(testDir, 'test.md');
      
      const mdContent = [
        '# 测试标题',
        '',
        '场景: 第一幕',
        'Cue: Cue01',
        '负责人: 张三',
        '',
        '## 第二部分',
        '',
        '- 列表项1',
        '- 列表项2'
      ].join('\n');
      
      await fs.writeFile(mdPath, mdContent);
      
      const result = await parser.parseText(mdPath);
      
      expect(result.errors.length).toBe(0);
      expect(result.data.length).toBe(1);
      expect(result.data[0].rows.length).toBeGreaterThan(0);
    });
  });

  describe('validateFields', () => {
    it('应报告缺少必填字段的问题', () => {
      const data = [
        { name: '王座', scene: '第一幕' },
        { name: '宝剑' }
      ];
      
      const issues = parser.validateFields(data, 'props');
      
      expect(issues.length).toBe(1);
      expect(issues[0].message).toContain('scene');
    });

    it('对于灯光应检查cueNumber', () => {
      const data = [
        { cueNumber: 1 },
        { description: '没有编号' }
      ];
      
      const issues = parser.validateFields(data, 'lighting');
      
      expect(issues.length).toBe(1);
    });
  });
});
