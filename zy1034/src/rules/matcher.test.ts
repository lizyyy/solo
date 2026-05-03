import { RuleMatcher } from './matcher';
import { RulesConfig, Rule, FileInfo, RuleCondition } from '../types';

describe('RuleMatcher', () => {
  const createRulesConfig = (rules: Rule[]): RulesConfig => ({
    version: '1.0',
    rules,
    defaultConflictStrategy: 'rename',
    defaultOperation: 'move',
    excludePatterns: []
  });

  const createFileInfo = (overrides: Partial<FileInfo> = {}): FileInfo => ({
    path: '/test/file',
    name: 'test.txt',
    extension: '.txt',
    size: 1024,
    modifiedAt: new Date(),
    createdAt: new Date(),
    ...overrides
  });

  describe('扩展名匹配', () => {
    it('应该匹配单个扩展名', () => {
      const config = createRulesConfig([
        {
          name: 'PDF文档',
          condition: {
            extensions: ['.pdf']
          },
          destination: './PDF'
        }
      ]);

      const matcher = new RuleMatcher(config);
      const file = createFileInfo({
        name: 'document.pdf',
        extension: '.pdf'
      });

      const result = matcher.findMatchingRule(file);
      expect(result).not.toBeNull();
      expect(result?.rule.name).toBe('PDF文档');
    });

    it('应该匹配多个扩展名之一', () => {
      const config = createRulesConfig([
        {
          name: '图片文件',
          condition: {
            extensions: ['.png', '.jpg', '.jpeg']
          },
          destination: './Images'
        }
      ]);

      const matcher = new RuleMatcher(config);
      
      const jpgFile = createFileInfo({
        name: 'photo.jpg',
        extension: '.jpg'
      });
      const pngFile = createFileInfo({
        name: 'image.png',
        extension: '.png'
      });

      expect(matcher.findMatchingRule(jpgFile)).not.toBeNull();
      expect(matcher.findMatchingRule(pngFile)).not.toBeNull();
    });

    it('应该不匹配不同的扩展名', () => {
      const config = createRulesConfig([
        {
          name: 'PDF文档',
          condition: {
            extensions: ['.pdf']
          },
          destination: './PDF'
        }
      ]);

      const matcher = new RuleMatcher(config);
      const file = createFileInfo({
        name: 'document.docx',
        extension: '.docx'
      });

      const result = matcher.findMatchingRule(file);
      expect(result).toBeNull();
    });

    it('应该忽略扩展名大小写', () => {
      const config = createRulesConfig([
        {
          name: 'PDF文档',
          condition: {
            extensions: ['pdf']
          },
          destination: './PDF'
        }
      ]);

      const matcher = new RuleMatcher(config);
      const file = createFileInfo({
        name: 'document.PDF',
        extension: '.PDF'
      });

      const result = matcher.findMatchingRule(file);
      expect(result).not.toBeNull();
    });
  });

  describe('关键词匹配', () => {
    it('应该匹配文件名中的关键词', () => {
      const config = createRulesConfig([
        {
          name: '截图文件',
          condition: {
            keywords: ['screenshot', '截图']
          },
          destination: './Screenshots'
        }
      ]);

      const matcher = new RuleMatcher(config);
      const file = createFileInfo({
        name: 'screenshot_2024.png',
        extension: '.png'
      });

      const result = matcher.findMatchingRule(file);
      expect(result).not.toBeNull();
    });

    it('应该忽略关键词大小写', () => {
      const config = createRulesConfig([
        {
          name: '发票文件',
          condition: {
            keywords: ['INVOICE']
          },
          destination: './Invoices'
        }
      ]);

      const matcher = new RuleMatcher(config);
      const file = createFileInfo({
        name: 'invoice_2024.pdf',
        extension: '.pdf'
      });

      const result = matcher.findMatchingRule(file);
      expect(result).not.toBeNull();
    });

    it('应该不匹配不包含关键词的文件名', () => {
      const config = createRulesConfig([
        {
          name: '截图文件',
          condition: {
            keywords: ['screenshot']
          },
          destination: './Screenshots'
        }
      ]);

      const matcher = new RuleMatcher(config);
      const file = createFileInfo({
        name: 'document.pdf',
        extension: '.pdf'
      });

      const result = matcher.findMatchingRule(file);
      expect(result).toBeNull();
    });
  });

  describe('文件大小匹配', () => {
    it('应该匹配大于等于最小大小的文件', () => {
      const config = createRulesConfig([
        {
          name: '大文件',
          condition: {
            minSize: 1024 * 1024
          },
          destination: './Large'
        }
      ]);

      const matcher = new RuleMatcher(config);
      
      const largeFile = createFileInfo({
        size: 2 * 1024 * 1024
      });
      const smallFile = createFileInfo({
        size: 512 * 1024
      });

      expect(matcher.findMatchingRule(largeFile)).not.toBeNull();
      expect(matcher.findMatchingRule(smallFile)).toBeNull();
    });

    it('应该匹配小于等于最大大小的文件', () => {
      const config = createRulesConfig([
        {
          name: '小文件',
          condition: {
            maxSize: 1024 * 1024
          },
          destination: './Small'
        }
      ]);

      const matcher = new RuleMatcher(config);
      
      const smallFile = createFileInfo({
        size: 512 * 1024
      });
      const largeFile = createFileInfo({
        size: 2 * 1024 * 1024
      });

      expect(matcher.findMatchingRule(smallFile)).not.toBeNull();
      expect(matcher.findMatchingRule(largeFile)).toBeNull();
    });

    it('应该匹配大小范围内的文件', () => {
      const config = createRulesConfig([
        {
          name: '中等文件',
          condition: {
            minSize: 1024,
            maxSize: 1024 * 1024
          },
          destination: './Medium'
        }
      ]);

      const matcher = new RuleMatcher(config);
      
      const tooSmall = createFileInfo({ size: 512 });
      const inRange = createFileInfo({ size: 10 * 1024 });
      const tooLarge = createFileInfo({ size: 2 * 1024 * 1024 });

      expect(matcher.findMatchingRule(tooSmall)).toBeNull();
      expect(matcher.findMatchingRule(inRange)).not.toBeNull();
      expect(matcher.findMatchingRule(tooLarge)).toBeNull();
    });
  });

  describe('时间范围匹配', () => {
    const baseDate = new Date('2024-01-15T12:00:00Z');

    it('应该匹配修改时间在指定日期之后的文件', () => {
      const config = createRulesConfig([
        {
          name: '近期文件',
          condition: {
            modifiedAfter: '2024-01-01T00:00:00Z'
          },
          destination: './Recent'
        }
      ]);

      const matcher = new RuleMatcher(config);
      
      const recentFile = createFileInfo({
        modifiedAt: new Date('2024-01-10T12:00:00Z')
      });
      const oldFile = createFileInfo({
        modifiedAt: new Date('2023-12-31T12:00:00Z')
      });

      expect(matcher.findMatchingRule(recentFile)).not.toBeNull();
      expect(matcher.findMatchingRule(oldFile)).toBeNull();
    });

    it('应该匹配修改时间在指定日期之前的文件', () => {
      const config = createRulesConfig([
        {
          name: '旧文件',
          condition: {
            modifiedBefore: '2024-01-01T00:00:00Z'
          },
          destination: './Old'
        }
      ]);

      const matcher = new RuleMatcher(config);
      
      const oldFile = createFileInfo({
        modifiedAt: new Date('2023-12-31T12:00:00Z')
      });
      const recentFile = createFileInfo({
        modifiedAt: new Date('2024-01-10T12:00:00Z')
      });

      expect(matcher.findMatchingRule(oldFile)).not.toBeNull();
      expect(matcher.findMatchingRule(recentFile)).toBeNull();
    });

    it('应该匹配创建时间在指定日期之后的文件', () => {
      const config = createRulesConfig([
        {
          name: '新文件',
          condition: {
            createdAfter: '2024-01-01T00:00:00Z'
          },
          destination: './New'
        }
      ]);

      const matcher = new RuleMatcher(config);
      
      const newFile = createFileInfo({
        createdAt: new Date('2024-01-10T12:00:00Z')
      });
      const oldFile = createFileInfo({
        createdAt: new Date('2023-12-31T12:00:00Z')
      });

      expect(matcher.findMatchingRule(newFile)).not.toBeNull();
      expect(matcher.findMatchingRule(oldFile)).toBeNull();
    });
  });

  describe('多条件组合', () => {
    it('应该匹配所有条件都满足的文件', () => {
      const config = createRulesConfig([
        {
          name: '大PDF文档',
          condition: {
            extensions: ['.pdf'],
            minSize: 1024 * 1024
          },
          destination: './LargePDF'
        }
      ]);

      const matcher = new RuleMatcher(config);
      
      const matchFile = createFileInfo({
        name: 'document.pdf',
        extension: '.pdf',
        size: 2 * 1024 * 1024
      });
      const smallPDF = createFileInfo({
        name: 'small.pdf',
        extension: '.pdf',
        size: 1024
      });
      const largeDocx = createFileInfo({
        name: 'large.docx',
        extension: '.docx',
        size: 2 * 1024 * 1024
      });

      expect(matcher.findMatchingRule(matchFile)).not.toBeNull();
      expect(matcher.findMatchingRule(smallPDF)).toBeNull();
      expect(matcher.findMatchingRule(largeDocx)).toBeNull();
    });

    it('应该匹配扩展名和关键词的组合', () => {
      const config = createRulesConfig([
        {
          name: '发票PDF',
          condition: {
            extensions: ['.pdf'],
            keywords: ['invoice', '发票']
          },
          destination: './Invoices'
        }
      ]);

      const matcher = new RuleMatcher(config);
      
      const invoicePDF = createFileInfo({
        name: 'invoice_2024.pdf',
        extension: '.pdf'
      });
      const regularPDF = createFileInfo({
        name: 'document.pdf',
        extension: '.pdf'
      });

      expect(matcher.findMatchingRule(invoicePDF)).not.toBeNull();
      expect(matcher.findMatchingRule(regularPDF)).toBeNull();
    });
  });

  describe('规则优先级', () => {
    it('应该优先匹配高优先级的规则', () => {
      const config = createRulesConfig([
        {
          name: '普通PDF',
          condition: {
            extensions: ['.pdf']
          },
          destination: './PDF',
          priority: 0
        },
        {
          name: '重要PDF',
          condition: {
            extensions: ['.pdf'],
            keywords: ['important']
          },
          destination: './Important',
          priority: 10
        }
      ]);

      const matcher = new RuleMatcher(config);
      
      const importantPDF = createFileInfo({
        name: 'important_document.pdf',
        extension: '.pdf'
      });
      const regularPDF = createFileInfo({
        name: 'document.pdf',
        extension: '.pdf'
      });

      const importantResult = matcher.findMatchingRule(importantPDF);
      const regularResult = matcher.findMatchingRule(regularPDF);

      expect(importantResult).not.toBeNull();
      expect(importantResult?.rule.name).toBe('重要PDF');
      
      expect(regularResult).not.toBeNull();
      expect(regularResult?.rule.name).toBe('普通PDF');
    });

    it('应该按定义顺序匹配相同优先级的规则', () => {
      const config = createRulesConfig([
        {
          name: '第一个规则',
          condition: {
            extensions: ['.pdf']
          },
          destination: './First',
          priority: 0
        },
        {
          name: '第二个规则',
          condition: {
            extensions: ['.pdf']
          },
          destination: './Second',
          priority: 0
        }
      ]);

      const matcher = new RuleMatcher(config);
      
      const file = createFileInfo({
        name: 'document.pdf',
        extension: '.pdf'
      });

      const result = matcher.findMatchingRule(file);
      expect(result).not.toBeNull();
      expect(result?.rule.name).toBe('第一个规则');
    });
  });

  describe('多规则匹配', () => {
    it('应该找到所有匹配的规则', () => {
      const config = createRulesConfig([
        {
          name: 'PDF文档',
          condition: {
            extensions: ['.pdf']
          },
          destination: './PDF'
        },
        {
          name: '大文件',
          condition: {
            minSize: 1024 * 1024
          },
          destination: './Large'
        },
        {
          name: '发票文件',
          condition: {
            keywords: ['invoice']
          },
          destination: './Invoices'
        }
      ]);

      const matcher = new RuleMatcher(config);
      
      const file = createFileInfo({
        name: 'invoice_2024.pdf',
        extension: '.pdf',
        size: 2 * 1024 * 1024
      });

      const results = matcher.findAllMatchingRules(file);
      
      expect(results).toHaveLength(3);
      const ruleNames = results.map(r => r.rule.name);
      expect(ruleNames).toContain('PDF文档');
      expect(ruleNames).toContain('大文件');
      expect(ruleNames).toContain('发票文件');
    });
  });
});
