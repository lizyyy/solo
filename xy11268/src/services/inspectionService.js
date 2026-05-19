const APOLOGY_KEYWORDS = [
  '抱歉', '对不起', '不好意思', '道歉', '致歉', '深表歉意',
  'sorry', 'apologize', 'apology'
];

const REFUND_KEYWORDS = [
  '退款', '退钱', '退费', '全额退款', '部分退款', '退还',
  'refund', 'money back'
];

const SENSITIVE_WORDS = [
  '傻逼', '操你妈', '滚蛋', '去死', '垃圾', '废物',
  'fuck', 'shit', 'damn', 'bitch'
];

function detectApology(transcript) {
  const lowerText = transcript.toLowerCase();
  return APOLOGY_KEYWORDS.some(keyword => lowerText.includes(keyword.toLowerCase()));
}

function detectRefundPromise(transcript) {
  const lowerText = transcript.toLowerCase();
  return REFUND_KEYWORDS.some(keyword => lowerText.includes(keyword.toLowerCase()));
}

function detectSensitiveWords(transcript) {
  const lowerText = transcript.toLowerCase();
  const found = SENSITIVE_WORDS.filter(word => lowerText.includes(word.toLowerCase()));
  return found;
}

function generateSummary(transcript, inspection) {
  const issues = [];
  if (!inspection.hasApology) {
    issues.push('缺少道歉');
  }
  if (!inspection.hasRefundPromise) {
    issues.push('缺少退款承诺');
  }
  if (inspection.hasSensitiveWord) {
    issues.push('包含敏感词');
  }
  
  if (issues.length === 0) {
    return '通话记录正常，包含道歉、退款承诺（如适用），无敏感词。';
  }
  
  return `检测到问题：${issues.join('、')}。转写文本长度${transcript.length}字符。`;
}

function getAnomalyTypes(inspection) {
  const types = [];
  if (!inspection.hasApology) {
    types.push('missing_apology');
  }
  if (!inspection.hasRefundPromise) {
    types.push('missing_refund_promise');
  }
  if (inspection.hasSensitiveWord) {
    types.push('sensitive_word');
  }
  return types;
}

function inspectTranscript(transcript) {
  const hasApology = detectApology(transcript);
  const hasRefundPromise = detectRefundPromise(transcript);
  const sensitiveWords = detectSensitiveWords(transcript);
  const hasSensitiveWord = sensitiveWords.length > 0;
  
  const inspection = {
    hasApology,
    hasRefundPromise,
    hasSensitiveWord,
    sensitiveWords: JSON.stringify(sensitiveWords)
  };
  
  inspection.summary = generateSummary(transcript, inspection);
  inspection.anomalyTypes = JSON.stringify(getAnomalyTypes(inspection));
  
  return inspection;
}

module.exports = {
  inspectTranscript,
  detectApology,
  detectRefundPromise,
  detectSensitiveWords
};
