const logger = require('../config/logger');

const classificationRules = [
  {
    type: 'door_error',
    keywords: ['柜门', '门', '打不开', '开不了', '卡住', '关不上', '锁', '门控', '仓门'],
    weight: 3
  },
  {
    type: 'scan_failure',
    keywords: ['扫码', '扫不上', '二维码', '扫描', '识别', '码扫', '扫码失败', '无法扫码'],
    weight: 3
  },
  {
    type: 'empty_bin_false_alarm',
    keywords: ['空仓', '误报', '空仓误报', '没有电池', '显示空', '空仓报警', '误报警'],
    weight: 3
  },
  {
    type: 'battery_error',
    keywords: ['电池', '电瓶', '换电', '电池故障', '无法换电', '换电失败', '电池异常'],
    weight: 2
  },
  {
    type: 'system_error',
    keywords: ['系统', 'app', 'APP', '软件', '服务器', '网络', '连接', '登录', '崩溃', '死机'],
    weight: 2
  }
];

const classifyTicket = (description) => {
  if (!description || typeof description !== 'string') {
    return {
      type: null,
      confidence: 0,
      matchedKeywords: []
    };
  }

  const scores = {};
  const matchedKeywords = [];

  classificationRules.forEach(rule => {
    scores[rule.type] = 0;
    
    rule.keywords.forEach(keyword => {
      if (description.includes(keyword)) {
        scores[rule.type] += rule.weight;
        if (!matchedKeywords.includes(keyword)) {
          matchedKeywords.push(keyword);
        }
      }
    });
  });

  let maxScore = 0;
  let bestType = null;

  Object.entries(scores).forEach(([type, score]) => {
    if (score > maxScore) {
      maxScore = score;
      bestType = type;
    }
  });

  const totalPossibleScore = classificationRules.reduce((sum, rule) => sum + rule.weight * rule.keywords.length, 0);
  const confidence = totalPossibleScore > 0 ? (maxScore / Math.min(totalPossibleScore, 10)) : 0;

  logger.info('客服单分类完成', {
    description: description.substring(0, 50) + '...',
    resultType: bestType,
    confidence: confidence.toFixed(2),
    matchedKeywords
  });

  return {
    type: bestType || 'other',
    confidence: Math.min(confidence, 1),
    matchedKeywords
  };
};

const batchClassify = (tickets) => {
  return tickets.map(ticket => {
    const result = classifyTicket(ticket.description);
    return {
      ...ticket,
      problemType: result.type,
      classificationConfidence: result.confidence,
      matchedKeywords: result.matchedKeywords
    };
  });
};

module.exports = {
  classifyTicket,
  batchClassify
};
