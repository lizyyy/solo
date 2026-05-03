import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import { RuleParser } from './parser';
import { RulesConfig } from '../types';

describe('RuleParser', () => {
  let tempDir: string;
  let parser: RuleParser;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'file-archiver-test-'));
    parser = new RuleParser();
  });

  afterEach(() => {
    if (tempDir && fs.existsSync(tempDir)) {
      fs.removeSync(tempDir);
    }
  });

  describe('YAML 解析', () => {
    it('应该正确解析有效的 YAML 规则文件', async () => {
      const yamlContent = `
version: "1.0"
defaultConflictStrategy: rename
defaultOperation: move
excludePatterns:
  - "node_modules/**"
  - "*.tmp"
rules:
  - name: "PDF文档"
    condition:
      extensions:
        - pdf
    destination: "./Documents"
    description: "PDF文件归档"
    priority: 1
  - name: "图片文件"
    condition:
      extensions:
        - png
        - jpg
        - jpeg
      keywords:
        - screenshot
    destination: "./Images"
`;

      const yamlPath = path.join(tempDir, 'rules.yaml');
      fs.writeFileSync(yamlPath, yamlContent, 'utf-8');

      const config = await parser.parseFile(yamlPath);

      expect(config).toBeDefined();
      expect(config.version).toBe('1.0');
      expect(config.defaultConflictStrategy).toBe('rename');
      expect(config.defaultOperation).toBe('move');
      expect(config.rules).toHaveLength(2);
      expect(config.excludePatterns).toEqual(['node_modules/**', '*.tmp']);

      const pdfRule = config.rules.find(r => r.name === 'PDF文档');
      expect(pdfRule).toBeDefined();
      expect(pdfRule?.condition.extensions).toEqual(['.pdf']);
      expect(pdfRule?.destination).toBe('./Documents');

      const imageRule = config.rules.find(r => r.name === '图片文件');
      expect(imageRule).toBeDefined();
      expect(imageRule?.condition.extensions).toEqual(['.png', '.jpg', '.jpeg']);
      expect(imageRule?.condition.keywords).toEqual(['screenshot']);
    });
  });

  describe('JSON 解析', () => {
    it('应该正确解析有效的 JSON 规则文件', async () => {
      const jsonContent = JSON.stringify({
        version: '1.0',
        defaultConflictStrategy: 'skip',
        rules: [
          {
            name: '安装包',
            condition: {
              extensions: ['dmg', 'exe', 'pkg']
            },
            destination: './Installers'
          }
        ]
      }, null, 2);

      const jsonPath = path.join(tempDir, 'rules.json');
      fs.writeFileSync(jsonPath, jsonContent, 'utf-8');

      const config = await parser.parseFile(jsonPath);

      expect(config).toBeDefined();
      expect(config.version).toBe('1.0');
      expect(config.defaultConflictStrategy).toBe('skip');
      expect(config.rules).toHaveLength(1);
      expect(config.rules[0].name).toBe('安装包');
    });
  });

  describe('规则验证', () => {
    it('应该抛出错误当规则文件不存在', async () => {
      const nonExistentPath = path.join(tempDir, 'nonexistent.yaml');
      
      await expect(parser.parseFile(nonExistentPath)).rejects.toThrow(/不存在/);
    });

    it('应该抛出错误当规则文件格式错误', async () => {
      const invalidYaml = `
version: "1.0"
rules:
  - name: 无效规则
    condition:
      extensions:
        - pdf
    缺少冒号和值
`;

      const yamlPath = path.join(tempDir, 'invalid.yaml');
      fs.writeFileSync(yamlPath, invalidYaml, 'utf-8');

      await expect(parser.parseFile(yamlPath)).rejects.toThrow(/解析错误/);
    });

    it('应该抛出错误当规则缺少必填字段', async () => {
      const invalidConfig = {
        version: '1.0',
        rules: [
          {
            name: '无效规则'
          }
        ]
      };

      const jsonPath = path.join(tempDir, 'invalid-rules.json');
      fs.writeFileSync(jsonPath, JSON.stringify(invalidConfig), 'utf-8');

      await expect(parser.parseFile(jsonPath)).rejects.toThrow(/验证失败/);
    });

    it('应该抛出错误当规则条件为空', async () => {
      const invalidConfig = {
        version: '1.0',
        rules: [
          {
            name: '空条件规则',
            condition: {},
            destination: './Test'
          }
        ]
      };

      const jsonPath = path.join(tempDir, 'empty-condition.json');
      fs.writeFileSync(jsonPath, JSON.stringify(invalidConfig), 'utf-8');

      await expect(parser.parseFile(jsonPath)).rejects.toThrow(/至少需要指定一个匹配条件/);
    });

    it('应该验证日期格式', async () => {
      const invalidConfig = {
        version: '1.0',
        rules: [
          {
            name: '无效日期规则',
            condition: {
              modifiedAfter: '无效日期'
            },
            destination: './Test'
          }
        ]
      };

      const jsonPath = path.join(tempDir, 'invalid-date.json');
      fs.writeFileSync(jsonPath, JSON.stringify(invalidConfig), 'utf-8');

      await expect(parser.parseFile(jsonPath)).rejects.toThrow(/不是有效的日期格式/);
    });

    it('应该验证 minSize 不能大于 maxSize', async () => {
      const invalidConfig = {
        version: '1.0',
        rules: [
          {
            name: '无效大小规则',
            condition: {
              minSize: 1000,
              maxSize: 100
            },
            destination: './Test'
          }
        ]
      };

      const jsonPath = path.join(tempDir, 'invalid-size.json');
      fs.writeFileSync(jsonPath, JSON.stringify(invalidConfig), 'utf-8');

      await expect(parser.parseFile(jsonPath)).rejects.toThrow(/minSize 不能大于 maxSize/);
    });
  });

  describe('扩展名规范化', () => {
    it('应该自动添加点号到扩展名', async () => {
      const config = {
        version: '1.0',
        rules: [
          {
            name: '测试规则',
            condition: {
              extensions: ['pdf', 'doc', '.txt']
            },
            destination: './Test'
          }
        ]
      };

      const jsonPath = path.join(tempDir, 'extensions.json');
      fs.writeFileSync(jsonPath, JSON.stringify(config), 'utf-8');

      const result = await parser.parseFile(jsonPath);

      expect(result.rules[0].condition.extensions).toEqual(['.pdf', '.doc', '.txt']);
    });
  });

  describe('冲突策略验证', () => {
    it('应该拒绝无效的冲突策略', async () => {
      const invalidConfig = {
        version: '1.0',
        defaultConflictStrategy: 'invalid',
        rules: [
          {
            name: '测试规则',
            condition: {
              extensions: ['pdf']
            },
            destination: './Test'
          }
        ]
      };

      const jsonPath = path.join(tempDir, 'invalid-strategy.json');
      fs.writeFileSync(jsonPath, JSON.stringify(invalidConfig), 'utf-8');

      await expect(parser.parseFile(jsonPath)).rejects.toThrow(/无效的冲突策略/);
    });

    it('应该接受有效的冲突策略', async () => {
      for (const strategy of ['rename', 'skip', 'error']) {
        const config = {
          version: '1.0',
          defaultConflictStrategy: strategy,
          rules: [
            {
              name: '测试规则',
              condition: {
                extensions: ['pdf']
              },
              destination: './Test'
            }
          ]
        };

        const jsonPath = path.join(tempDir, `strategy-${strategy}.json`);
        fs.writeFileSync(jsonPath, JSON.stringify(config), 'utf-8');

        const result = await parser.parseFile(jsonPath);
        expect(result.defaultConflictStrategy).toBe(strategy);
      }
    });
  });

  describe('排除模式', () => {
    it('应该验证排除模式是数组', async () => {
      const invalidConfig = {
        version: '1.0',
        excludePatterns: 'not-an-array',
        rules: [
          {
            name: '测试规则',
            condition: {
              extensions: ['pdf']
            },
            destination: './Test'
          }
        ]
      };

      const jsonPath = path.join(tempDir, 'invalid-exclude.json');
      fs.writeFileSync(jsonPath, JSON.stringify(invalidConfig), 'utf-8');

      await expect(parser.parseFile(jsonPath)).rejects.toThrow(/excludePatterns 必须是数组/);
    });
  });
});
