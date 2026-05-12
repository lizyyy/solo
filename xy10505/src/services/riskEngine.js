const config = require('../config');
const db = require('../database');
const { generateId, formatAmount } = require('../utils');

const riskRules = [
  {
    name: 'amount_threshold_check',
    description: '检查合同金额是否超过阈值，超过需要加签',
    level: config.riskLevels.MEDIUM,
    execute: (application, contract, history) => {
      const threshold = config.riskThreshold.amount;
      const amount = contract.amount;
      
      if (amount > threshold) {
        return {
          pass: false,
          riskReason: `合同金额 ${formatAmount(amount)} 超过阈值 ${formatAmount(threshold)}，需要高级管理人员加签`,
          suggestion: '请在审批链中增加财务总监或总经理审批',
          extraData: {
            amount,
            threshold,
            needAdditionalApprover: true,
            additionalApproverRole: 'GENERAL_MANAGER',
          },
        };
      }
      
      return {
        pass: true,
        riskReason: null,
        suggestion: null,
        extraData: { needAdditionalApprover: false },
      };
    },
  },

  {
    name: 'seal_type_match_check',
    description: '检查印章类型是否与合同类型匹配',
    level: config.riskLevels.HIGH,
    execute: (application, contract, history) => {
      const sealType = application.seal_type;
      const category = contract.category;
      
      const categorySealMap = {
        SALES: ['COMPANY_SEAL', 'CONTRACT_SEAL'],
        PURCHASE: ['COMPANY_SEAL', 'CONTRACT_SEAL'],
        SERVICE: ['COMPANY_SEAL', 'CONTRACT_SEAL'],
        COOPERATION: ['COMPANY_SEAL', 'CONTRACT_SEAL'],
      };

      const validSeals = categorySealMap[category] || ['COMPANY_SEAL', 'CONTRACT_SEAL'];
      const isValid = validSeals.includes(sealType);
      
      const shouldFail = (sealType === 'FINANCIAL_SEAL' || sealType === 'LEGAL_SEAL');
      
      if (shouldFail) {
        return {
          pass: false,
          riskReason: `合同类型 [${config.contractCategories[category] || category}] 与印章类型 [${config.sealTypes[sealType] || sealType}] 不匹配`,
          suggestion: '普通合同应使用公司公章或合同专用章，财务专用章仅用于财务凭证',
          extraData: {
            contractCategory: category,
            sealType,
          },
        };
      }
      
      return {
        pass: true,
        riskReason: null,
        suggestion: null,
        extraData: null,
      };
    },
  },

  {
    name: 'withdrawn_history_check',
    description: '检查是否有撤回记录，如果有则标记需要重新审批',
    level: config.riskLevels.MEDIUM,
    execute: (application, contract, history) => {
      const withdrawnApps = history.filter(h => h.status === config.approvalStatus.WITHDRAWN);
      
      if (withdrawnApps.length > 0) {
        const lastWithdrawn = withdrawnApps[withdrawnApps.length - 1];
        return {
          pass: false,
          riskReason: `该合同存在历史撤回记录，共撤回 ${withdrawnApps.length} 次，最后一次撤回时间：${lastWithdrawn.withdrawn_at}`,
          suggestion: '建议审批人仔细核对撤回后修改的内容，确认变更是否合理',
          extraData: {
            withdrawCount: withdrawnApps.length,
            lastWithdrawTime: lastWithdrawn.withdrawn_at,
            lastWithdrawReason: lastWithdrawn.withdraw_reason,
          },
        };
      }
      
      return {
        pass: true,
        riskReason: null,
        suggestion: null,
        extraData: null,
      };
    },
  },

  {
    name: 'subject_change_check',
    description: '检查合同主体是否发生变更，主体变更后旧审批失效',
    level: config.riskLevels.CRITICAL,
    execute: (application, contract, history) => {
      if (!application.original_application_id) {
        return {
          pass: true,
          riskReason: null,
          suggestion: null,
          extraData: null,
        };
      }

      const originalApp = db.runGet(
        `SELECT * FROM seal_applications WHERE id = ?`,
        [application.original_application_id]
      );

      if (!originalApp) {
        return {
          pass: true,
          riskReason: null,
          suggestion: null,
          extraData: null,
        };
      }

      const originalContract = db.runGet(
        `SELECT * FROM contracts WHERE id = ?`,
        [originalApp.contract_id]
      );

      if (!originalContract) {
        return {
          pass: true,
          riskReason: null,
          suggestion: null,
          extraData: null,
        };
      }

      const subjectChanges = [];

      if (originalContract.party_a !== contract.party_a) {
        subjectChanges.push({
          field: '甲方',
          oldValue: originalContract.party_a,
          newValue: contract.party_a,
        });
      }
      if (originalContract.party_b !== contract.party_b) {
        subjectChanges.push({
          field: '乙方',
          oldValue: originalContract.party_b,
          newValue: contract.party_b,
        });
      }

      if (subjectChanges.length > 0) {
        return {
          pass: false,
          riskReason: `合同主体发生变更：${subjectChanges.map(c => `${c.field}: ${c.oldValue} → ${c.newValue}`).join('; ')}`,
          suggestion: '合同主体变更属于重大变更，所有历史审批已失效，必须重新走完整审批流程',
          extraData: {
            subjectChanges,
            invalidatePreviousApprovals: true,
          },
        };
      }
      
      return {
        pass: true,
        riskReason: null,
        suggestion: null,
        extraData: null,
      };
    },
  },

  {
    name: 'duplicate_application_check',
    description: '检查是否存在重复的在用申请',
    level: config.riskLevels.HIGH,
    execute: (application, contract, history) => {
      const activeStatuses = [
        config.approvalStatus.DRAFT,
        config.approvalStatus.PENDING,
        config.approvalStatus.APPROVING,
        config.approvalStatus.APPROVED,
        config.approvalStatus.SEALED,
      ];

      const duplicateApps = history.filter(h => 
        activeStatuses.includes(h.status) && 
        h.id !== application.id
      );

      if (duplicateApps.length > 0) {
        return {
          pass: false,
          riskReason: `存在 ${duplicateApps.length} 个相同合同的在用申请，存在重复用章风险`,
          suggestion: '请先处理其他在用申请（通过或取消）后再继续',
          extraData: {
            duplicateApplicationIds: duplicateApps.map(a => a.id),
          },
        };
      }
      
      return {
        pass: true,
        riskReason: null,
        suggestion: null,
        extraData: null,
      };
    },
  },

  {
    name: 'amount_change_check',
    description: '检查撤回后金额是否发生重大变化',
    level: config.riskLevels.HIGH,
    execute: (application, contract, history) => {
      if (!application.original_application_id) {
        return {
          pass: true,
          riskReason: null,
          suggestion: null,
          extraData: null,
        };
      }

      const originalApp = db.runGet(
        `SELECT * FROM seal_applications WHERE id = ?`,
        [application.original_application_id]
      );

      if (!originalApp) {
        return {
          pass: true,
          riskReason: null,
          suggestion: null,
          extraData: null,
        };
      }

      const originalContract = db.runGet(
        `SELECT * FROM contracts WHERE id = ?`,
        [originalApp.contract_id]
      );

      if (!originalContract) {
        return {
          pass: true,
          riskReason: null,
          suggestion: null,
          extraData: null,
        };
      }

      const currentAmount = contract.amount;
      const prevAmount = originalContract.amount;

      if (prevAmount !== currentAmount) {
        const changePercent = Math.abs((currentAmount - prevAmount) / prevAmount) * 100;
        if (changePercent > 10) {
          return {
            pass: false,
            riskReason: `合同金额发生重大变化，变化幅度：${changePercent.toFixed(2)}%，从 ${formatAmount(prevAmount)} 变更为 ${formatAmount(currentAmount)}`,
            suggestion: '金额变化超过10%，建议审批人重点关注金额变更原因',
            extraData: {
              oldAmount: prevAmount,
              newAmount: currentAmount,
              changePercent: changePercent.toFixed(2) + '%',
            },
          };
        }
      }
      
      return {
        pass: true,
        riskReason: null,
        suggestion: null,
        extraData: null,
      };
    },
  },
];

function runRiskScan(application, contract, applicationHistory = []) {
  const results = [];

  for (const rule of riskRules) {
    const result = rule.execute(application, contract, applicationHistory);
    
    const scanResult = {
      id: generateId(),
      applicationId: application.id,
      ruleName: rule.name,
      ruleDescription: rule.description,
      riskLevel: rule.level,
      isPass: result.pass ? 1 : 0,
      riskReason: result.riskReason,
      suggestion: result.suggestion,
      scanTime: new Date().toISOString(),
    };

    db.runExec(`
      INSERT INTO risk_scan_results 
      (id, application_id, scan_time, rule_name, rule_description, risk_level, is_pass, risk_reason, suggestion)
      VALUES (?, ?, CURRENT_TIMESTAMP, ?, ?, ?, ?, ?, ?)
    `, [scanResult.id, scanResult.applicationId, scanResult.ruleName, scanResult.ruleDescription, scanResult.riskLevel, scanResult.isPass, scanResult.riskReason, scanResult.suggestion]);

    results.push(scanResult);
  }

  const overallResult = {
    allPassed: results.every(r => r.isPass === 1),
    criticalRisks: results.filter(r => r.riskLevel === config.riskLevels.CRITICAL && r.isPass === 0),
    highRisks: results.filter(r => r.riskLevel === config.riskLevels.HIGH && r.isPass === 0),
    mediumRisks: results.filter(r => r.riskLevel === config.riskLevels.MEDIUM && r.isPass === 0),
    results,
  };

  return overallResult;
}

function getApplicationRiskHistory(applicationId) {
  return db.runAll(`SELECT * FROM risk_scan_results WHERE application_id = ? ORDER BY scan_time DESC`, [applicationId]);
}

function getLatestRiskScan(applicationId) {
  const scans = db.runAll(`SELECT * FROM risk_scan_results WHERE application_id = ? ORDER BY scan_time DESC LIMIT 100`, [applicationId]);

  if (scans.length === 0) return null;

  const latestTime = scans[0].scan_time;
  const latestScanGroup = scans.filter(s => s.scan_time === latestTime);

  return {
    scanTime: latestTime,
    allPassed: latestScanGroup.every(r => r.is_pass === 1),
    results: latestScanGroup,
  };
}

module.exports = {
  riskRules,
  runRiskScan,
  getApplicationRiskHistory,
  getLatestRiskScan,
};
