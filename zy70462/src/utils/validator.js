const SENSITIVE_PATTERNS = {
  phone: /1[3-9]\d{9}/g,
  idCard: /[1-9]\d{5}(18|19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\d{3}[\dXx]/g,
  email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
  bankCard: /\d{16,19}/g,
  name: /(姓名|客户名|用户名)[:：]\s*[\u4e00-\u9fa5]{2,4}/g
};

function checkDownloadUrlValid(url) {
  if (!url) return { valid: false, reason: '下载链接为空' };
  
  const expirationPatterns = [
    /expired|失效|过期/i,
    /404|not.?found/i,
    /timestamp=\d+.*expire/i,
    /expires?=[0-9a-f]+/i
  ];
  
  for (const pattern of expirationPatterns) {
    if (pattern.test(url)) {
      return { valid: false, reason: '下载链接已失效' };
    }
  }
  
  return { valid: true };
}

function validateDesensitization(content) {
  const findings = [];
  let riskLevel = 'low';
  
  for (const [type, pattern] of Object.entries(SENSITIVE_PATTERNS)) {
    const matches = content.match(pattern);
    if (matches && matches.length > 0) {
      findings.push({
        type,
        count: matches.length,
        samples: matches.slice(0, 3)
      });
      
      if (matches.length >= 5) {
        riskLevel = 'high';
      } else if (matches.length >= 2) {
        riskLevel = 'medium';
      }
    }
  }
  
  const isSuccess = findings.length === 0;
  
  return {
    success: isSuccess,
    riskLevel,
    findings,
    status: isSuccess ? 'success' : 'failure',
    failureReason: isSuccess ? null : `发现 ${findings.length} 类敏感数据未脱敏`
  };
}

function validateMaterial(material) {
  const content = material.content || '';
  const downloadCheck = checkDownloadUrlValid(material.downloadUrl);
  
  if (!downloadCheck.valid) {
    return {
      success: false,
      riskLevel: 'critical',
      findings: [],
      status: 'failure',
      failureReason: downloadCheck.reason,
      isUrlFailure: true
    };
  }
  
  return validateDesensitization(content);
}

function requiresManualConfirm(materialType, fileName) {
  const manualConfirmTypes = ['财务结转表', 'financial_report', 'finance'];
  return manualConfirmTypes.some(type => 
    fileName.includes(type) || materialType === type
  );
}

module.exports = {
  validateMaterial,
  validateDesensitization,
  checkDownloadUrlValid,
  requiresManualConfirm,
  SENSITIVE_PATTERNS
};