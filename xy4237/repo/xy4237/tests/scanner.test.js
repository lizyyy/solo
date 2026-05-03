const path = require('path');
const fs = require('fs-extra');
const Scanner = require('../src/scanner');

describe('Scanner', () => {
  let scanner;
  let testDir;

  beforeEach(() => {
    scanner = new Scanner();
    testDir = path.join(__dirname, 'test-temp');
  });

  afterEach(async () => {
    if (await fs.pathExists(testDir)) {
      await fs.remove(testDir);
    }
  });

  describe('scan', () => {
    it('应抛出错误当目录不存在', async () => {
      await expect(scanner.scan('/non/existent/path')).rejects.toThrow();
    });

    it('应正确扫描目录中的文件', async () => {
      await fs.ensureDir(testDir);
      await fs.writeFile(path.join(testDir, '道具清单.csv'), 'test');
      await fs.writeFile(path.join(testDir, '灯光cue.json'), '{}');
      await fs.writeFile(path.join(testDir, 'readme.txt'), 'readme');

      const files = await scanner.scan(testDir);

      expect(files.length).toBe(3);
    });

    it('应正确分类文件类型', async () => {
      await fs.ensureDir(testDir);
      
      const testFiles = [
        { name: '道具清单.csv', category: 'props' },
        { name: '灯光_cue.json', category: 'lighting' },
        { name: '演员出场表.csv', category: 'actors' },
        { name: '临时改动备注.md', category: 'notes' },
        { name: 'unknown_file.txt', category: 'unknown' }
      ];

      for (const file of testFiles) {
        await fs.writeFile(path.join(testDir, file.name), 'test');
      }

      const files = await scanner.scan(testDir);

      for (const expected of testFiles) {
        const found = files.find(f => f.name === expected.name);
        expect(found).toBeDefined();
        expect(found.category).toBe(expected.category);
      }
    });

    it('应递归扫描子目录', async () => {
      await fs.ensureDir(testDir);
      await fs.ensureDir(path.join(testDir, 'subdir'));
      
      await fs.writeFile(path.join(testDir, '道具清单.csv'), 'test');
      await fs.writeFile(path.join(testDir, 'subdir', '灯光cue.json'), '{}');

      const files = await scanner.scan(testDir);

      expect(files.length).toBe(2);
      expect(files.some(f => f.name === '道具清单.csv')).toBe(true);
      expect(files.some(f => f.name === '灯光cue.json')).toBe(true);
    });

    it('应跳过隐藏目录和node_modules', async () => {
      await fs.ensureDir(testDir);
      await fs.ensureDir(path.join(testDir, '.hidden'));
      await fs.ensureDir(path.join(testDir, 'node_modules'));
      
      await fs.writeFile(path.join(testDir, '道具清单.csv'), 'test');
      await fs.writeFile(path.join(testDir, '.hidden', 'hidden.csv'), 'test');
      await fs.writeFile(path.join(testDir, 'node_modules', 'lib.csv'), 'test');

      const files = await scanner.scan(testDir);

      expect(files.length).toBe(1);
      expect(files[0].name).toBe('道具清单.csv');
    });
  });

  describe('validateFiles', () => {
    it('应报告道具清单缺失的问题', () => {
      const files = [
        { name: '灯光.json', category: 'lighting' }
      ];

      const result = scanner.validateFiles(files);

      expect(result.issues.some(i => i.message.includes('道具'))).toBe(true);
    });

    it('应报告空文件问题', () => {
      const files = [
        { name: '道具清单.csv', category: 'props', size: 0, path: '/test.csv' }
      ];

      const result = scanner.validateFiles(files);

      expect(result.issues.some(i => i.message.includes('为空'))).toBe(true);
    });

    it('应报告过多未分类文件的警告', () => {
      const files = Array.from({ length: 4 }, (_, i) => ({
        name: `file${i}.txt`,
        category: 'unknown'
      }));

      const result = scanner.validateFiles(files);

      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('_determineCategory', () => {
    it('应正确识别道具文件', () => {
      const propsNames = ['道具清单.csv', 'props.xlsx', '物品表.json', 'inventory.csv'];
      
      for (const name of propsNames) {
        expect(scanner._determineCategory(name)).toBe('props');
      }
    });

    it('应正确识别灯光文件', () => {
      const lightingNames = ['灯光cue.json', 'light_cues.xlsx', 'cue_list.csv'];
      
      for (const name of lightingNames) {
        expect(scanner._determineCategory(name)).toBe('lighting');
      }
    });

    it('应正确识别演员文件', () => {
      const actorNames = ['演员出场表.csv', 'actors.xlsx', '入场表.json'];
      
      for (const name of actorNames) {
        expect(scanner._determineCategory(name)).toBe('actors');
      }
    });

    it('应正确识别备注文件', () => {
      const noteNames = ['临时改动.md', 'notes.txt', '备注.json'];
      
      for (const name of noteNames) {
        expect(scanner._determineCategory(name)).toBe('notes');
      }
    });

    it('应返回unknown对于无法识别的文件', () => {
      expect(scanner._determineCategory('random_file.txt')).toBe('unknown');
    });
  });
});
