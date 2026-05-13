const _ = require('lodash');

const CHANNEL_LIMITS = {
  sms: {
    maxLength: 67,
    description: '短信单条最大67个字符（中文/符号各算1个）'
  },
  email: {
    subjectMaxLength: 100,
    description: '邮件主题最大100个字符'
  },
  inApp: {
    titleMaxLength: 50,
    description: '站内信标题最大50个字符'
  }
};

function extractVariables(content) {
  if (!content) return [];
  const regex = /\{\{([^{}]+)\}\}/g;
  const matches = [];
  let match;
  while ((match = regex.exec(content)) !== null) {
    matches.push(match[1]);
  }
  return [...new Set(matches)];
}

function replaceVariables(content, variableValues) {
  if (!content) return content;
  return content.replace(/\{\{([^{}]+)\}\}/g, (_, varName) => {
    if (variableValues && variableValues[varName] !== undefined) {
      return String(variableValues[varName]);
    }
    return `{{${varName}}}`;
  });
}

function validateTemplate(version, variables, channelLimits) {
  const errors = [];
  const warnings = [];
  const details = {};

  const allChannelContent = {
    sms: version.smsContent,
    email: `${version.emailSubject || ''} ${version.emailContent || ''}`,
    inApp: `${version.inAppTitle || ''} ${version.inAppContent || ''}`
  };

  const allUsedVariables = new Set();
  Object.entries(allChannelContent).forEach(([channel, content]) => {
    const vars = extractVariables(content);
    vars.forEach(v => allUsedVariables.add(v));
  });

  const variableDict = {};
  (variables || []).forEach(v => {
    variableDict[v.variableName] = v;
  });

  const usedVariableValues = {};
  Object.entries(variableDict).forEach(([name, v]) => {
    usedVariableValues[name] = v.defaultValue || '';
  });

  const missingRequired = [];
  const usedButNotDefined = [];

  allUsedVariables.forEach(varName => {
    const variable = variableDict[varName];
    if (!variable) {
      usedButNotDefined.push(varName);
      errors.push(`变量 {{${varName}}} 在模板中使用但未在变量字典中定义`);
    } else if (variable.isRequired && !variable.defaultValue) {
      missingRequired.push(varName);
    }
  });

  (variables || []).forEach(v => {
    if (v.isRequired && !allUsedVariables.has(v.variableName)) {
      warnings.push(`必填变量 {{${v.variableName}}} 已定义但未在任何渠道模板中使用`);
    }
  });

  if (usedButNotDefined.length > 0) {
    details.usedButNotDefined = usedButNotDefined;
  }
  if (missingRequired.length > 0) {
    details.missingRequired = missingRequired;
    errors.push(`存在必填变量缺少默认值: ${missingRequired.join(', ')}`);
  }

  const channelErrors = {};
  const limits = channelLimits || CHANNEL_LIMITS;

  if (version.smsContent) {
    const replacedSms = replaceVariables(version.smsContent, usedVariableValues);
    const smsLength = replacedSms.length;
    const smsMax = limits.sms?.maxLength || 67;
    
    if (smsLength > smsMax) {
      channelErrors.sms = {
        length: smsLength,
        maxLength: smsMax,
        message: `短信内容长度超限，当前${smsLength}字符，最大${smsMax}字符`
      };
      errors.push(channelErrors.sms.message);
    }
  }

  if (version.emailSubject) {
    const replacedSubject = replaceVariables(version.emailSubject, usedVariableValues);
    const subjectLength = replacedSubject.length;
    const subjectMax = limits.email?.subjectMaxLength || 100;
    
    if (subjectLength > subjectMax) {
      channelErrors.email = {
        field: 'subject',
        length: subjectLength,
        maxLength: subjectMax,
        message: `邮件主题长度超限，当前${subjectLength}字符，最大${subjectMax}字符`
      };
      errors.push(channelErrors.email.message);
    }
  }

  if (version.inAppTitle) {
    const replacedTitle = replaceVariables(version.inAppTitle, usedVariableValues);
    const titleLength = replacedTitle.length;
    const titleMax = limits.inApp?.titleMaxLength || 50;
    
    if (titleLength > titleMax) {
      channelErrors.inApp = {
        field: 'title',
        length: titleLength,
        maxLength: titleMax,
        message: `站内信标题长度超限，当前${titleLength}字符，最大${titleMax}字符`
      };
      errors.push(channelErrors.inApp.message);
    }
  }

  if (Object.keys(channelErrors).length > 0) {
    details.channelErrors = channelErrors;
  }

  details.variableChecks = {
    usedVariables: Array.from(allUsedVariables),
    definedVariables: Object.keys(variableDict),
    variablesWithDefaults: usedVariableValues
  };

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    details
  };
}

function simulateSending(version, variables, testData = {}) {
  const results = {};
  const variableValues = {};
  
  (variables || []).forEach(v => {
    variableValues[v.variableName] = testData[v.variableName] !== undefined 
      ? testData[v.variableName] 
      : (v.defaultValue || '');
  });

  if (version.smsContent) {
    const replaced = replaceVariables(version.smsContent, variableValues);
    results.sms = {
      success: true,
      renderedContent: replaced,
      length: replaced.length,
      maxLength: 67,
      isOverLimit: replaced.length > 67
    };
  }

  if (version.emailContent || version.emailSubject) {
    results.email = {
      success: true,
      renderedSubject: replaceVariables(version.emailSubject || '', variableValues),
      renderedContent: replaceVariables(version.emailContent || '', variableValues)
    };
  }

  if (version.inAppContent || version.inAppTitle) {
    results.inApp = {
      success: true,
      renderedTitle: replaceVariables(version.inAppTitle || '', variableValues),
      renderedContent: replaceVariables(version.inAppContent || '', variableValues)
    };
  }

  return {
    success: true,
    variableValues,
    channels: results
  };
}

function checkConcurrency(templateId, { TemplateVersion, ReleaseRecord, sequelize }) {
  return sequelize.transaction(async (t) => {
    const pendingReleases = await ReleaseRecord.findAll({
      where: {
        templateId,
        status: ['pending', 'running']
      },
      transaction: t
    });

    const gradualVersions = await TemplateVersion.findAll({
      where: {
        templateId,
        status: 'gradual'
      },
      transaction: t
    });

    return {
      hasPendingReleases: pendingReleases.length > 0,
      hasGradualVersions: gradualVersions.length > 0,
      pendingReleases,
      gradualVersions
    };
  });
}

function validateReleaseRules(version, template, { TemplateVersion, ReleaseRecord, sequelize }) {
  return sequelize.transaction(async (t) => {
    const errors = [];

    if (version.status === 'rolled_back') {
      errors.push('该版本已被回滚，不能再次发布');
    }

    const concurrency = await checkConcurrency(template.id, { TemplateVersion, ReleaseRecord, sequelize });
    
    if (concurrency.hasPendingReleases) {
      errors.push('存在正在进行中的发布操作，请等待完成后再试');
    }

    return {
      valid: errors.length === 0,
      errors,
      concurrency
    };
  });
}

function getSampleTestData(category) {
  const samples = {
    verification: {
      code: '123456',
      expireMinutes: 5,
      productName: '我的应用'
    },
    billing: {
      userName: '张三',
      billMonth: '2024年1月',
      amount: '199.00',
      dueDate: '2024-01-31'
    },
    promotion: {
      productName: '新年特惠',
      discount: '8折',
      validUntil: '2024-02-01',
      couponCode: 'NEWYEAR2024'
    }
  };
  
  return samples[category] || samples.verification;
}

module.exports = {
  CHANNEL_LIMITS,
  extractVariables,
  replaceVariables,
  validateTemplate,
  simulateSending,
  checkConcurrency,
  validateReleaseRules,
  getSampleTestData
};