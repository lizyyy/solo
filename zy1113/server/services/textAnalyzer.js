const db = require('../config/database');

const defaultTaxonomy = [
  { code: 'install_misunderstand', name: '安装误解', keywords: '安装,不会装,看不懂说明书,安装说明,怎么装,安装步骤' },
  { code: 'parts_shortage', name: '配件缺货', keywords: '缺货,没货,配件,零件,缺少,缺件,没配件' },
  { code: 'technician_no_show', name: '师傅爽约', keywords: '师傅没来,爽约,迟到,没来,师傅没到,约好的没来' },
  { code: 'fee_dispute', name: '收费争议', keywords: '收费,太贵,价格,钱,贵了,收费标准,乱收费,多收钱' },
  { code: 'product_quality', name: '产品质量', keywords: '坏了,质量,故障,修不好,反复坏,次品,问题,质量差' },
  { code: 'delivery_delay', name: '配送延迟', keywords: '配送,送货,延迟,没到,快递,物流,送晚了' },
  { code: 'after_sales_service', name: '售后服务', keywords: '售后,客服,态度,服务不好,投诉,不满意' },
  { code: 'return_exchange', name: '退换货', keywords: '退货,换货,退款,退钱,不想要了,换一个' },
  { code: 'other', name: '其他', keywords: '其他,别的,不知道,不清楚' }
];

function loadTaxonomy() {
  const categories = db.prepare('SELECT * FROM categories').all();
  if (categories.length === 0) {
    defaultTaxonomy.forEach(cat => {
      db.prepare(`
        INSERT INTO categories (code, name, keywords)
        VALUES (?, ?, ?)
      `).run(cat.code, cat.name, cat.keywords);
    });
    return defaultTaxonomy;
  }
  return categories;
}

function cleanText(text) {
  if (!text) return '';
  
  let cleaned = text
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/[^\u4e00-\u9fa5a-zA-Z0-9\s]/g, '')
    .trim();
  
  return cleaned;
}

function extractKeywords(text) {
  const stopWords = new Set([
    '的', '了', '是', '在', '我', '有', '和', '就', '不', '人', '都', '一', '一个',
    '上', '也', '很', '到', '说', '要', '去', '你', '会', '着', '没有', '看', '好',
    '自己', '这', '那', '他', '她', '它', '们', '这个', '那个', '什么', '怎么',
    '为什么', '哪', '哪里', '谁', '多少', '几', '啊', '吧', '呢', '吗', '呀'
  ]);

  const words = text.match(/[\u4e00-\u9fa5]{2,}|[a-zA-Z]+/g) || [];
  const keywords = words.filter(word => !stopWords.has(word) && word.length > 1);
  
  const freq = {};
  keywords.forEach(word => {
    freq[word] = (freq[word] || 0) + 1;
  });

  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .map(([word]) => word);
}

function calculateSimilarity(text1, text2) {
  const keywords1 = new Set(extractKeywords(text1));
  const keywords2 = new Set(extractKeywords(text2));
  
  if (keywords1.size === 0 || keywords2.size === 0) return 0;

  let intersection = 0;
  keywords1.forEach(k => {
    if (keywords2.has(k)) intersection++;
  });

  const union = keywords1.size + keywords2.size - intersection;
  return union > 0 ? intersection / union : 0;
}

function attributeCall(callText, categories) {
  const cleaned = cleanText(callText);
  const keywords = extractKeywords(cleaned);
  
  const results = categories.map(category => {
    const categoryKeywords = (category.keywords || '').split(/[,，\s]+/).filter(k => k);
    let matchCount = 0;
    const matchedKeywords = [];

    keywords.forEach(kw => {
      categoryKeywords.forEach(catKw => {
        if (kw.includes(catKw) || catKw.includes(kw)) {
          matchCount++;
          if (!matchedKeywords.includes(kw)) {
            matchedKeywords.push(kw);
          }
        }
      });
    });

    const confidence = categoryKeywords.length > 0 
      ? Math.min(1, matchCount / Math.max(1, categoryKeywords.length)) 
      : 0;

    return {
      category_code: category.code,
      category_name: category.name,
      confidence: confidence,
      matched_keywords: matchedKeywords,
      evidence: matchedKeywords.length > 0 
        ? `匹配关键词: ${matchedKeywords.join(', ')}` 
        : '无明确匹配'
    };
  });

  results.sort((a, b) => b.confidence - a.confidence);

  const manualSamples = db.prepare(`
    SELECT cn.cleaned_text, a.category_code
    FROM call_notes cn
    JOIN attributions a ON cn.call_id = a.call_id
    WHERE a.is_manual = 1
  `).all();

  if (manualSamples.length > 0 && cleaned) {
    manualSamples.forEach(sample => {
      if (sample.cleaned_text) {
        const similarity = calculateSimilarity(cleaned, sample.cleaned_text);
        if (similarity > 0.3) {
          const existing = results.find(r => r.category_code === sample.category_code);
          if (existing) {
            existing.confidence = Math.max(existing.confidence, similarity * 0.8);
            existing.matched_keywords.push(`历史样本匹配(${Math.round(similarity * 100)}%)`);
          }
        }
      }
    });
    results.sort((a, b) => b.confidence - a.confidence);
  }

  const bestMatch = results[0];
  return {
    best_match: bestMatch,
    all_matches: results,
    cleaned_text: cleaned,
    extracted_keywords: keywords
  };
}

function extractCommitments(text) {
  const commitments = [];
  const commitmentPatterns = [
    { pattern: /(明天|后天|下[周一二三四五六日天]|\d+[天号日])[以回]?(?:回电|打电话|联系|回复)/g, type: '回电' },
    { pattern: /(?:补寄|补发|寄|发|送)(?:配件|零件|产品|东西|货)/g, type: '补寄配件' },
    { pattern: /(?:安排|预约|约)(?:师傅|安装|维修|上门)/g, type: '安排上门' },
    { pattern: /(?:退款|退钱|退货|换货)/g, type: '退换货' },
    { pattern: /(?:下周|下个月|下一次|等通知)/g, type: '后续跟进' }
  ];

  const dayMap = {
    '明天': 1,
    '后天': 2
  };

  commitmentPatterns.forEach(({ pattern, type }) => {
    let match;
    const regex = new RegExp(pattern.source, 'g');
    
    while ((match = regex.exec(text)) !== null) {
      const matchedText = match[0];
      let deadlineDays = 3;
      
      const daysMatch = matchedText.match(/(\d+)[天]/);
      if (daysMatch) {
        deadlineDays = parseInt(daysMatch[1]);
      } else if (matchedText.includes('明天')) {
        deadlineDays = 1;
      } else if (matchedText.includes('后天')) {
        deadlineDays = 2;
      } else if (matchedText.includes('下周')) {
        deadlineDays = 7;
      }

      commitments.push({
        content: matchedText,
        type: type,
        deadline_days: deadlineDays,
        priority: deadlineDays <= 1 ? 'high' : deadlineDays <= 3 ? 'medium' : 'low'
      });
    }
  });

  return commitments;
}

module.exports = {
  loadTaxonomy,
  cleanText,
  extractKeywords,
  calculateSimilarity,
  attributeCall,
  extractCommitments,
  defaultTaxonomy
};
