const { v4: uuidv4 } = require('uuid');

const BOUNCE_CODES = {
  permanent: [
    { code: '550', desc: '邮箱不存在或被拒绝', category: 'invalid_email' },
    { code: '551', desc: '用户不存在', category: 'invalid_email' },
    { code: '552', desc: '邮箱空间已满', category: 'mailbox_full' },
    { code: '553', desc: '邮箱地址无效', category: 'invalid_email' },
    { code: '554', desc: '传输失败', category: 'delivery_failed' },
    { code: '500', desc: '语法错误', category: 'syntax_error' },
    { code: '501', desc: '参数语法错误', category: 'syntax_error' },
    { code: '502', desc: '命令未实现', category: 'command_error' },
    { code: '503', desc: '命令序列错误', category: 'command_error' },
    { code: '504', desc: '参数未实现', category: 'command_error' }
  ],
  temporary: [
    { code: '421', desc: '服务不可用', category: 'service_unavailable' },
    { code: '450', desc: '邮箱不可用（可能是临时）', category: 'mailbox_busy' },
    { code: '451', desc: '处理中出错', category: 'processing_error' },
    { code: '452', desc: '系统存储空间不足', category: 'insufficient_storage' },
    { code: '422', desc: '收件人邮箱已满（临时）', category: 'mailbox_full_temp' },
    { code: '441', desc: '收件人服务器无响应', category: 'server_timeout' },
    { code: '442', desc: '连接被丢弃', category: 'connection_dropped' },
    { code: '447', desc: '发送超时', category: 'timeout' },
    { code: '450', desc: '被策略拦截（可能是频率限制）', category: 'policy_block' }
  ]
};

const DOMAIN_CATEGORIES = {
  enterprise: [
    'company.com', 'enterprise.com', 'corp.com', 'techcorp.com',
    'financebank.com', 'healthcare.org', 'edu.edu', 'gov.gov'
  ],
  personal: [
    'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com',
    'qq.com', '163.com', '126.com', 'sina.com'
  ],
  free: [
    'mail.com', 'inbox.com', 'zoho.com', 'protonmail.com'
  ]
};

function extractDomain(email) {
  if (!email || !email.includes('@')) return 'unknown';
  return email.split('@')[1].toLowerCase();
}

function classifyBounce(code) {
  if (!code) return { type: 'unknown', category: 'missing_code', desc: '缺少标准退信码' };
  
  const codeStr = String(code);
  const numericCode = codeStr.match(/\d{3}/);
  
  if (!numericCode) {
    return { type: 'unknown', category: 'unrecognized_code', desc: `无法识别的退信码: ${code}` };
  }
  
  const codeNum = numericCode[0];
  
  const permanent = BOUNCE_CODES.permanent.find(c => codeNum.startsWith(c.code));
  if (permanent) {
    return { type: 'permanent', ...permanent };
  }
  
  const temporary = BOUNCE_CODES.temporary.find(c => codeNum.startsWith(c.code));
  if (temporary) {
    return { type: 'temporary', ...temporary };
  }
  
  if (codeNum.startsWith('5')) {
    return { type: 'permanent', category: 'other_permanent', desc: `其他永久失败 (${codeNum})` };
  }
  
  if (codeNum.startsWith('4')) {
    return { type: 'temporary', category: 'other_temporary', desc: `其他临时失败 (${codeNum})` };
  }
  
  return { type: 'unknown', category: 'unrecognized', desc: `未知退信码类型: ${codeNum}` };
}

function classifyDomain(domain) {
  if (DOMAIN_CATEGORIES.enterprise.includes(domain)) return 'enterprise';
  if (DOMAIN_CATEGORIES.personal.includes(domain)) return 'personal';
  if (DOMAIN_CATEGORIES.free.includes(domain)) return 'free';
  return 'other';
}

function shouldRetry(email, bounces, retries, unsubscribed) {
  if (unsubscribed.includes(email)) {
    return { shouldRetry: false, reason: '已退订，不能重试' };
  }
  
  const emailBounces = bounces.filter(b => b.email === email);
  const emailRetries = retries.filter(r => r.email === email);
  
  const latestBounce = emailBounces.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0];
  
  if (!latestBounce) {
    return { shouldRetry: true, reason: '无退信记录，可以重试' };
  }
  
  const bounceInfo = classifyBounce(latestBounce.bounceCode);
  
  if (bounceInfo.type === 'permanent') {
    if (bounceInfo.category === 'invalid_email') {
      return { shouldRetry: false, reason: '邮箱无效，永久失败' };
    }
    if (bounceInfo.category === 'mailbox_full') {
      return { shouldRetry: true, reason: '邮箱已满，可等待后重试', waitDays: 7 };
    }
    return { shouldRetry: false, reason: `永久失败: ${bounceInfo.desc}` };
  }
  
  if (bounceInfo.type === 'temporary') {
    const successfulRetries = emailRetries.filter(r => r.success);
    const failedRetries = emailRetries.filter(r => !r.success);
    
    if (successfulRetries.length > 0) {
      return { shouldRetry: true, reason: '之前重试成功，可以继续尝试' };
    }
    
    if (failedRetries.length >= 3) {
      return { shouldRetry: false, reason: '临时失败重试3次仍失败，建议标记为永久失败' };
    }
    
    return { 
      shouldRetry: true, 
      reason: `临时失败，可以重试 (已重试${failedRetries.length}次)`,
      waitDays: bounceInfo.category === 'mailbox_full_temp' ? 3 : 1
    };
  }
  
  return { shouldRetry: false, reason: '未知退信类型，建议人工审核' };
}

function determineStatus(email, bounces, retries, unsubscribed) {
  if (unsubscribed.includes(email)) {
    return 'unsubscribed';
  }
  
  const emailBounces = bounces.filter(b => b.email === email);
  const emailRetries = retries.filter(r => r.email === email);
  
  if (emailBounces.length === 0) {
    return 'valid';
  }
  
  const latestBounce = emailBounces.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0];
  const bounceInfo = classifyBounce(latestBounce.bounceCode);
  
  const successfulRetries = emailRetries.filter(r => r.success);
  if (successfulRetries.length > 0) {
    return 'valid';
  }
  
  if (bounceInfo.type === 'permanent') {
    if (bounceInfo.category === 'mailbox_full') {
      return 'temporary_bounce';
    }
    return 'invalid';
  }
  
  if (bounceInfo.type === 'temporary') {
    const failedRetries = emailRetries.filter(r => !r.success);
    if (failedRetries.length >= 3) {
      return 'invalid';
    }
    return 'temporary_bounce';
  }
  
  return 'needs_review';
}

function analyzeEmail(email, sendLogs, bounces, retries, sources, unsubscribed) {
  const emailSends = sendLogs.filter(s => s.email === email);
  const emailBounces = bounces.filter(b => b.email === email);
  const emailRetries = retries.filter(r => r.email === email);
  const source = sources.find(s => s.emails && s.emails.includes(email)) || { name: 'unknown' };
  
  const domain = extractDomain(email);
  const domainCategory = classifyDomain(domain);
  const retryInfo = shouldRetry(email, bounces, retries, unsubscribed);
  const status = determineStatus(email, bounces, retries, unsubscribed);
  
  const bounceHistory = emailBounces.map(b => {
    const info = classifyBounce(b.bounceCode);
    return {
      timestamp: b.timestamp,
      bounceCode: b.bounceCode,
      type: info.type,
      category: info.category,
      desc: info.desc,
      message: b.message
    };
  });
  
  return {
    email,
    domain,
    domainCategory,
    source: source.name,
    status,
    sendCount: emailSends.length,
    bounceCount: emailBounces.length,
    retryCount: emailRetries.length,
    successfulRetries: emailRetries.filter(r => r.success).length,
    latestBounce: bounceHistory[0] || null,
    bounceHistory,
    retryHistory: emailRetries,
    retryInfo,
    isUnsubscribed: unsubscribed.includes(email)
  };
}

function generateId() {
  return uuidv4();
}

module.exports = {
  BOUNCE_CODES,
  DOMAIN_CATEGORIES,
  extractDomain,
  classifyBounce,
  classifyDomain,
  shouldRetry,
  determineStatus,
  analyzeEmail,
  generateId
};
