const FALSE_TRANSFER_REASONS = [
  '机器人无法理解',
  '用户要求转人工',
  '敏感话题触发',
  '重复询问',
  '系统故障'
];

const SHOULD_HANDLED_TAGS = [
  '咨询类',
  '查询类',
  '简单问题',
  'FAQ'
];

function isFalseTransfer(record) {
  const { data } = record;
  const botResult = data['机器人处理结果'];
  const transferReason = data['转人工原因'];
  const tags = data['会话标签'] || '';

  const botCouldHandle = botResult === '已解决' || botResult === '部分解决';
  const isFalseReason = FALSE_TRANSFER_REASONS.some(r => 
    transferReason && transferReason.includes(r)
  );
  const isSimpleTag = SHOULD_HANDLED_TAGS.some(t => tags.includes(t));

  return isFalseReason || (botCouldHandle && isSimpleTag);
}

function isMissedTransfer(record) {
  const { data } = record;
  const isTransferred = data['是否转人工'] === '是' || data['是否转人工'] === 'true';
  const botResult = data['机器人处理结果'];
  const tags = data['会话标签'] || '';

  if (isTransferred) return false;

  const needsHuman = botResult === '未解决' || botResult === '无法处理';
  const isComplex = tags.includes('复杂') || tags.includes('投诉') || tags.includes('退款');

  return needsHuman || isComplex;
}

export function analyzeRecords(records) {
  const falseTransfers = [];
  const missedTransfers = [];
  const normalRecords = [];

  for (const record of records) {
    const { data } = record;
    const isTransferred = data['是否转人工'] === '是' || data['是否转人工'] === 'true';

    record.analysis = {};

    if (isTransferred) {
      if (isFalseTransfer(record)) {
        record.analysis.type = '误转';
        record.analysis.reason = getFalseTransferReason(record);
        falseTransfers.push(record);
      } else {
        record.analysis.type = '正常转接';
        normalRecords.push(record);
      }
    } else {
      if (isMissedTransfer(record)) {
        record.analysis.type = '漏转';
        record.analysis.reason = getMissedTransferReason(record);
        missedTransfers.push(record);
      } else {
        record.analysis.type = '机器人正常处理';
        normalRecords.push(record);
      }
    }
  }

  return { falseTransfers, missedTransfers, normalRecords };
}

function getFalseTransferReason(record) {
  const { data } = record;
  const transferReason = data['转人工原因'];
  const botResult = data['机器人处理结果'];
  const tags = data['会话标签'] || '';

  const reasons = [];

  for (const r of FALSE_TRANSFER_REASONS) {
    if (transferReason && transferReason.includes(r)) {
      reasons.push(`触发原因: ${r}`);
    }
  }

  if (botResult === '已解决' || botResult === '部分解决') {
    reasons.push(`机器人已处理: ${botResult}`);
  }

  for (const t of SHOULD_HANDLED_TAGS) {
    if (tags.includes(t)) {
      reasons.push(`属于简单类型: ${t}`);
    }
  }

  return reasons.join('; ') || '符合误转规则';
}

function getMissedTransferReason(record) {
  const { data } = record;
  const botResult = data['机器人处理结果'];
  const tags = data['会话标签'] || '';

  const reasons = [];

  if (botResult === '未解决' || botResult === '无法处理') {
    reasons.push(`机器人未解决: ${botResult}`);
  }

  if (tags.includes('复杂')) {
    reasons.push('会话类型: 复杂问题');
  }
  if (tags.includes('投诉')) {
    reasons.push('会话类型: 投诉');
  }
  if (tags.includes('退款')) {
    reasons.push('会话类型: 退款申请');
  }

  return reasons.join('; ') || '建议转人工处理';
}

export function generateSummary(analysis, validationErrors, parseErrors) {
  const { falseTransfers, missedTransfers, normalRecords } = analysis;
  const allRecords = falseTransfers.length + missedTransfers.length + normalRecords.length;

  const byReason = {};
  for (const record of falseTransfers) {
    const reason = record.analysis.reason.split('; ')[0];
    byReason[reason] = (byReason[reason] || 0) + 1;
  }

  const byMissedReason = {};
  for (const record of missedTransfers) {
    const reason = record.analysis.reason.split('; ')[0];
    byMissedReason[reason] = (byMissedReason[reason] || 0) + 1;
  }

  const errorSummary = {};
  for (const err of [...validationErrors, ...parseErrors]) {
    errorSummary[err.type] = (errorSummary[err.type] || 0) + 1;
  }

  return {
    totals: {
      总会话数: allRecords,
      误转数: falseTransfers.length,
      漏转数: missedTransfers.length,
      正常处理数: normalRecords.length
    },
    rates: {
      误转率: allRecords > 0 ? (falseTransfers.length / allRecords * 100).toFixed(2) + '%' : '0%',
      漏转率: allRecords > 0 ? (missedTransfers.length / allRecords * 100).toFixed(2) + '%' : '0%'
    },
    falseTransferBreakdown: byReason,
    missedTransferBreakdown: byMissedReason,
    errorSummary
  };
}

export function sortRecordsForComparison(records) {
  return [...records].sort((a, b) => {
    const sessionA = a.data['会话ID'] || '';
    const sessionB = b.data['会话ID'] || '';
    if (sessionA !== sessionB) {
      return sessionA.localeCompare(sessionB);
    }

    const timeA = a.data['开始时间'] || '';
    const timeB = b.data['开始时间'] || '';
    return timeA.localeCompare(timeB);
  });
}