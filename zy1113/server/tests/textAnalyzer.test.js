const { describe, it, before } = require('node:test');
const assert = require('assert');
const {
  cleanText,
  extractKeywords,
  calculateSimilarity,
  extractCommitments,
  defaultTaxonomy
} = require('../services/textAnalyzer');

describe('TextAnalyzer', () => {
  describe('cleanText', () => {
    it('应该清理文本中的特殊字符', () => {
      const result = cleanText('你好，\n\t世界！这是测试文本。');
      assert.strictEqual(result, '你好 世界 这是测试文本');
    });

    it('应该处理空文本', () => {
      assert.strictEqual(cleanText(''), '');
      assert.strictEqual(cleanText(null), '');
      assert.strictEqual(cleanText(undefined), '');
    });

    it('应该处理只有空格的文本', () => {
      assert.strictEqual(cleanText('   '), '');
    });
  });

  describe('extractKeywords', () => {
    it('应该提取关键词', () => {
      const result = extractKeywords('客户反映产品质量有问题，需要维修。');
      assert.ok(Array.isArray(result));
      assert.ok(result.length > 0);
    });

    it('应该过滤停用词', () => {
      const result = extractKeywords('的了是在我有和就不');
      assert.strictEqual(result.length, 0);
    });

    it('应该处理空文本', () => {
      assert.deepStrictEqual(extractKeywords(''), []);
    });
  });

  describe('calculateSimilarity', () => {
    it('应该计算文本相似度', () => {
      const text1 = '产品质量有问题，需要维修';
      const text2 = '产品质量有问题，需要更换';
      const similarity = calculateSimilarity(text1, text2);
      assert.ok(similarity >= 0);
      assert.ok(similarity <= 1);
    });

    it('相同文本相似度应该为1', () => {
      const text = '测试文本';
      assert.strictEqual(calculateSimilarity(text, text), 1);
    });

    it('空文本相似度应该为0', () => {
      assert.strictEqual(calculateSimilarity('', '测试'), 0);
      assert.strictEqual(calculateSimilarity('测试', ''), 0);
    });
  });

  describe('extractCommitments', () => {
    it('应该提取回电承诺', () => {
      const result = extractCommitments('我明天回电给你确认。');
      assert.ok(result.length > 0);
      assert.ok(result.some(c => c.type === '回电'));
    });

    it('应该提取补寄配件承诺', () => {
      const result = extractCommitments('我们会补寄配件给您。');
      assert.ok(result.length > 0);
      assert.ok(result.some(c => c.type === '补寄配件'));
    });

    it('应该提取安排上门承诺', () => {
      const result = extractCommitments('我们会安排师傅明天上门。');
      assert.ok(result.length > 0);
      assert.ok(result.some(c => c.type === '安排上门'));
    });

    it('应该处理没有承诺的文本', () => {
      const result = extractCommitments('客户只是询问产品信息。');
      assert.deepStrictEqual(result, []);
    });

    it('应该设置正确的截止日期', () => {
      const result = extractCommitments('我明天回电给你。');
      assert.ok(result.length > 0);
      assert.strictEqual(result[0].deadline_days, 1);
      assert.strictEqual(result[0].priority, 'high');
    });

    it('后天回电应该是中优先级', () => {
      const result = extractCommitments('我后天回电给你。');
      assert.ok(result.length > 0);
      assert.strictEqual(result[0].deadline_days, 2);
      assert.strictEqual(result[0].priority, 'medium');
    });
  });

  describe('defaultTaxonomy', () => {
    it('应该包含所有预设分类', () => {
      assert.ok(defaultTaxonomy.length > 0);
      const codes = defaultTaxonomy.map(t => t.code);
      assert.ok(codes.includes('install_misunderstand'));
      assert.ok(codes.includes('parts_shortage'));
      assert.ok(codes.includes('technician_no_show'));
      assert.ok(codes.includes('fee_dispute'));
      assert.ok(codes.includes('product_quality'));
      assert.ok(codes.includes('delivery_delay'));
      assert.ok(codes.includes('after_sales_service'));
      assert.ok(codes.includes('return_exchange'));
      assert.ok(codes.includes('other'));
    });

    it('每个分类应该有关键词', () => {
      defaultTaxonomy.forEach(category => {
        assert.ok(category.code);
        assert.ok(category.name);
        assert.ok(category.keywords);
      });
    });
  });
});
