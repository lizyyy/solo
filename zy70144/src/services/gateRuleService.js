const { table, updateById } = require('../config/database');
const signatureService = require('./signatureService');
const scanService = require('./scanService');
const approvalService = require('./approvalService');

function getEnabledRules() {
  return table('gate_rules')
    .where('is_enabled', '=', true)
    .orderBy('priority', 'DESC')
    .all();
}

function getAllRules() {
  return table('gate_rules')
    .orderBy('priority', 'DESC')
    .all();
}

function updateRuleConfig(ruleId, config) {
  const rule = table('gate_rules').where('id', '=', ruleId).get();
  if (!rule) return null;

  updateById('gate_rules', ruleId, {
    config: config,
    updated_at: new Date().toISOString()
  });

  return getRuleById(ruleId);
}

function toggleRule(ruleId, isEnabled) {
  const rule = table('gate_rules').where('id', '=', ruleId).get();
  if (!rule) return null;

  updateById('gate_rules', ruleId, {
    is_enabled: isEnabled,
    updated_at: new Date().toISOString()
  });

  return getRuleById(ruleId);
}

function getRuleById(id) {
  return table('gate_rules').where('id', '=', id).get();
}

function checkSignatureRule(artifactId, rule) {
  const config = rule.config || { minValidSignatures: 1 };
  const validCount = signatureService.getValidSignatureCount(artifactId);
  const isPassed = validCount >= config.minValidSignatures;
  
  return {
    ruleId: rule.id,
    ruleName: rule.name,
    ruleType: rule.rule_type,
    isPassed,
    message: isPassed 
      ? `签名校验通过：有效签名数量 ${validCount} >= ${config.minValidSignatures}`
      : `签名校验失败：有效签名数量 ${validCount} < ${config.minValidSignatures}`,
    details: {
      validSignatures: validCount,
      required: config.minValidSignatures
    }
  };
}

function checkSecurityScanRule(artifactId, rule) {
  const config = rule.config || { allowCritical: 0, allowHigh: 0 };
  const latestScan = scanService.getLatestScanForArtifact(artifactId);
  
  if (!latestScan) {
    return {
      ruleId: rule.id,
      ruleName: rule.name,
      ruleType: rule.rule_type,
      isPassed: false,
      message: '安全扫描校验失败：未找到扫描记录',
      details: {
        hasScan: false
      }
    };
  }
  
  const criticalOverLimit = latestScan.critical_count > config.allowCritical;
  const highOverLimit = latestScan.high_count > config.allowHigh;
  const isPassed = !criticalOverLimit && !highOverLimit && latestScan.is_passed === true;
  
  let message;
  if (latestScan.is_passed !== true) {
    message = '安全扫描校验失败：扫描未标记为通过';
  } else if (criticalOverLimit) {
    message = `安全扫描校验失败：致命漏洞数量 ${latestScan.critical_count} > ${config.allowCritical}`;
  } else if (highOverLimit) {
    message = `安全扫描校验失败：高危漏洞数量 ${latestScan.high_count} > ${config.allowHigh}`;
  } else {
    message = `安全扫描校验通过：致命 ${latestScan.critical_count}，高危 ${latestScan.high_count}`;
  }
  
  return {
    ruleId: rule.id,
    ruleName: rule.name,
    ruleType: rule.rule_type,
    isPassed,
    message,
    details: {
      hasScan: true,
      scanId: latestScan.id,
      critical: latestScan.critical_count,
      high: latestScan.high_count,
      medium: latestScan.medium_count,
      low: latestScan.low_count,
      scanPassed: latestScan.is_passed === true,
      allowCritical: config.allowCritical,
      allowHigh: config.allowHigh
    }
  };
}

function checkApprovalRule(artifactId, rule) {
  const config = rule.config || { requireApproval: true };
  
  if (!config.requireApproval) {
    return {
      ruleId: rule.id,
      ruleName: rule.name,
      ruleType: rule.rule_type,
      isPassed: true,
      message: '审批规则已禁用，自动通过',
      details: {
        requireApproval: false
      }
    };
  }
  
  const hasApproved = approvalService.hasApprovedApproval(artifactId);
  const approvals = approvalService.getApprovalsForArtifact(artifactId);
  
  return {
    ruleId: rule.id,
    ruleName: rule.name,
    ruleType: rule.rule_type,
    isPassed: hasApproved,
    message: hasApproved 
      ? '审批校验通过：已找到已批准的审批记录'
      : '审批校验失败：未找到已批准的审批记录',
    details: {
      requireApproval: true,
      hasApproved,
      approvalCount: approvals.length,
      approvedCount: approvals.filter(a => a.status === 'approved').length
    }
  };
}

function evaluateGate(artifactId) {
  const rules = getEnabledRules();
  const results = [];
  let allPassed = true;
  
  for (const rule of rules) {
    let result;
    switch (rule.rule_type) {
      case 'signature':
        result = checkSignatureRule(artifactId, rule);
        break;
      case 'security_scan':
        result = checkSecurityScanRule(artifactId, rule);
        break;
      case 'approval':
        result = checkApprovalRule(artifactId, rule);
        break;
      default:
        result = {
          ruleId: rule.id,
          ruleName: rule.name,
          ruleType: rule.rule_type,
          isPassed: false,
          message: `未知规则类型: ${rule.rule_type}`,
          details: {}
        };
    }
    
    results.push(result);
    if (!result.isPassed) {
      allPassed = false;
    }
  }
  
  const failedRules = results.filter(r => !r.isPassed);
  const summary = {
    totalRules: results.length,
    passedRules: results.filter(r => r.isPassed).length,
    failedRules: failedRules.length,
    allPassed,
    failedRuleNames: failedRules.map(r => r.ruleName)
  };
  
  return {
    summary,
    rules: results,
    evaluatedAt: new Date().toISOString()
  };
}

module.exports = {
  getEnabledRules,
  getAllRules,
  getRuleById,
  updateRuleConfig,
  toggleRule,
  checkSignatureRule,
  checkSecurityScanRule,
  checkApprovalRule,
  evaluateGate
};
