const config = require('../config');
const sealService = require('./sealApplicationService');
const contractService = require('./contractService');
const riskEngine = require('./riskEngine');
const { formatDateTime, formatAmount } = require('../utils');

function generateApplicationReport(applicationId) {
  const detail = sealService.getApplicationDetail(applicationId);
  if (!detail) {
    throw new Error(`用章申请不存在: ${applicationId}`);
  }

  const {
    application,
    contract,
    approvalChain,
    statusHistory,
    fieldChanges,
    latestRisk,
    originalApplication,
    relatedApplications,
  } = detail;

  const riskSummary = buildRiskSummary(latestRisk);
  const approvalTimeline = buildApprovalTimeline(statusHistory, approvalChain);
  const fieldChangeSummary = buildFieldChangeSummary(fieldChanges, originalApplication, contract);

  const report = {
    reportGeneratedAt: formatDateTime(new Date()),
    applicationId: application.id,
    basicInfo: {
      applicationId: application.id,
      applicant: application.applicant,
      department: application.department,
      sealType: config.sealTypes[application.seal_type] || application.seal_type,
      reason: application.reason,
      status: application.status,
      createdAt: application.created_at,
      updatedAt: application.updated_at,
      isResubmit: !!application.original_application_id ? '是' : '否',
      resubmitCount: application.resubmit_count,
    },
    contractInfo: {
      contractNo: contract.contract_no,
      name: contract.name,
      category: config.contractCategories[contract.category] || contract.category,
      amount: formatAmount(contract.amount, contract.amount_currency),
      partyA: contract.party_a,
      partyB: contract.party_b,
    },
    approvalInfo: {
      chain: approvalChain.map(a => ({
        order: a.approver_order,
        approver: a.approver,
        role: a.role,
        status: a.status,
        approvedAt: a.approved_at,
        rejectedAt: a.rejected_at,
        comment: a.comment,
      })),
      currentApprover: approvalChain.find(a => a.status === 'APPROVING')?.approver || null,
    },
    riskInfo: riskSummary,
    timeline: approvalTimeline,
    fieldChanges: fieldChangeSummary,
    relatedApplications: relatedApplications.map(a => ({
      id: a.id,
      status: a.status,
      createdAt: a.created_at,
      isCurrent: a.id === application.id,
    })),
    sealStatus: {
      canSeal: application.status === config.approvalStatus.APPROVED,
      currentStatus: application.status,
      finalStatus: buildFinalStatus(application, latestRisk),
    },
  };

  return report;
}

function buildRiskSummary(latestRisk) {
  if (!latestRisk) {
    return {
      hasScan: false,
      allPassed: true,
      summary: '未执行风险扫描',
      risks: [],
    };
  }

  const failedRisks = latestRisk.results
    .filter(r => r.is_pass === 0)
    .map(r => ({
      rule: r.rule_name,
      description: r.rule_description,
      level: r.risk_level,
      reason: r.risk_reason,
      suggestion: r.suggestion,
    }));

  const criticalCount = failedRisks.filter(r => r.level === config.riskLevels.CRITICAL).length;
  const highCount = failedRisks.filter(r => r.level === config.riskLevels.HIGH).length;
  const mediumCount = failedRisks.filter(r => r.level === config.riskLevels.MEDIUM).length;

  return {
    hasScan: true,
    allPassed: latestRisk.allPassed,
    scanTime: latestRisk.scanTime,
    summary: latestRisk.allPassed 
      ? `所有风险规则检查通过` 
      : `存在风险：严重${criticalCount}个，高${highCount}个，中${mediumCount}个`,
    failedRisks,
    passedCount: latestRisk.results.filter(r => r.is_pass === 1).length,
    failedCount: failedRisks.length,
  };
}

function buildApprovalTimeline(statusHistory, approvalChain) {
  const timeline = [];

  for (const record of statusHistory) {
    timeline.push({
      time: record.created_at,
      operator: record.operator,
      action: record.action,
      fromStatus: record.from_status,
      toStatus: record.to_status,
      comment: record.comment,
      type: 'STATUS_CHANGE',
    });
  }

  for (const approval of approvalChain) {
    if (approval.status === 'APPROVED' && approval.approved_at) {
      timeline.push({
        time: approval.approved_at,
        operator: approval.approver,
        action: 'APPROVE_STEP',
        comment: approval.comment || '审批通过',
        step: approval.approver_order,
        type: 'APPROVAL',
      });
    }
    if (approval.status === 'REJECTED' && approval.rejected_at) {
      timeline.push({
        time: approval.rejected_at,
        operator: approval.approver,
        action: 'REJECT_STEP',
        comment: approval.comment,
        step: approval.approver_order,
        type: 'APPROVAL',
      });
    }
  }

  return timeline.sort((a, b) => new Date(a.time) - new Date(b.time));
}

function buildFieldChangeSummary(fieldChanges, originalApplication, currentContract) {
  const changes = [];

  for (const change of fieldChanges) {
    try {
      changes.push({
        time: change.created_at,
        operator: change.operator,
        field: change.field_name,
        oldValue: safeParse(change.old_value),
        newValue: safeParse(change.new_value),
      });
    } catch (e) {
      changes.push({
        time: change.created_at,
        operator: change.operator,
        field: change.field_name,
        oldValue: change.old_value,
        newValue: change.new_value,
      });
    }
  }

  return {
    totalChanges: changes.length,
    changes,
  };
}

function safeParse(jsonStr) {
  if (!jsonStr) return null;
  try {
    return JSON.parse(jsonStr);
  } catch {
    return jsonStr;
  }
}

function buildFinalStatus(application, latestRisk) {
  if (application.status === config.approvalStatus.SEALED) {
    return {
      status: '已闭环',
      reason: '已完成用章',
      canProceed: false,
    };
  }

  if (application.status === config.approvalStatus.APPROVED) {
    if (latestRisk && !latestRisk.allPassed) {
      const criticalRisks = latestRisk.results.filter(r => 
        r.risk_level === config.riskLevels.CRITICAL && r.is_pass === 0
      );
      if (criticalRisks.length > 0) {
        return {
          status: '风险待处理',
          reason: `存在未解决的严重风险: ${criticalRisks[0].risk_reason}`,
          canProceed: false,
        };
      }
    }
    return {
      status: '待用章',
      reason: '审批已通过，可以进行用章',
      canProceed: true,
    };
  }

  if (application.status === config.approvalStatus.REJECTED) {
    return {
      status: '已驳回',
      reason: '审批被驳回',
      canProceed: false,
    };
  }

  if (application.status === config.approvalStatus.WITHDRAWN) {
    return {
      status: '已撤回',
      reason: '申请已被撤回，可修改后重提',
      canProceed: false,
    };
  }

  return {
    status: '审批中',
    reason: '正在等待审批',
    canProceed: false,
  };
}

function generateTextReport(report) {
  const lines = [];
  lines.push('='.repeat(80));
  lines.push('用章申请风险报告');
  lines.push('='.repeat(80));
  lines.push(`生成时间: ${report.reportGeneratedAt}`);
  lines.push(`申请ID: ${report.applicationId}`);
  lines.push('');
  
  lines.push('【基本信息】');
  lines.push('-' .repeat(40));
  lines.push(`申请人: ${report.basicInfo.applicant}`);
  lines.push(`部门: ${report.basicInfo.department}`);
  lines.push(`印章类型: ${report.basicInfo.sealType}`);
  lines.push(`申请原因: ${report.basicInfo.reason}`);
  lines.push(`当前状态: ${report.basicInfo.status}`);
  lines.push(`创建时间: ${report.basicInfo.createdAt}`);
  lines.push(`是否重提: ${report.basicInfo.isResubmit}`);
  lines.push(`重提次数: ${report.basicInfo.resubmitCount}`);
  lines.push('');

  lines.push('【合同信息】');
  lines.push('-' .repeat(40));
  lines.push(`合同编号: ${report.contractInfo.contractNo}`);
  lines.push(`合同名称: ${report.contractInfo.name}`);
  lines.push(`合同类型: ${report.contractInfo.category}`);
  lines.push(`合同金额: ${report.contractInfo.amount}`);
  lines.push(`甲方: ${report.contractInfo.partyA}`);
  lines.push(`乙方: ${report.contractInfo.partyB}`);
  lines.push('');

  lines.push('【审批链信息】');
  lines.push('-' .repeat(40));
  for (const approver of report.approvalInfo.chain) {
    const statusIcon = approver.status === 'APPROVED' ? '✓' : 
                      approver.status === 'REJECTED' ? '✗' : 
                      approver.status === 'APPROVING' ? '⏳' : '○';
    lines.push(`  ${statusIcon} 第${approver.order}步: ${approver.approver} (${approver.role}) - ${approver.status}`);
    if (approver.comment) {
      lines.push(`     意见: ${approver.comment}`);
    }
  }
  if (report.approvalInfo.currentApprover) {
    lines.push(`当前审批人: ${report.approvalInfo.currentApprover}`);
  }
  lines.push('');

  lines.push('【风险扫描结果】');
  lines.push('-' .repeat(40));
  lines.push(`扫描状态: ${report.riskInfo.hasScan ? '已扫描' : '未扫描'}`);
  lines.push(`整体结果: ${report.riskInfo.allPassed ? '全部通过' : '存在风险'}`);
  lines.push(`风险汇总: ${report.riskInfo.summary}`);
  if (report.riskInfo.failedRisks.length > 0) {
    lines.push('风险详情:');
    for (const risk of report.riskInfo.failedRisks) {
      lines.push(`  [${risk.level}] ${risk.rule}: ${risk.reason}`);
      if (risk.suggestion) {
        lines.push(`     建议: ${risk.suggestion}`);
      }
    }
  }
  lines.push('');

  lines.push('【审批时间线】');
  lines.push('-' .repeat(40));
  for (const item of report.timeline) {
    lines.push(`  ${item.time} | ${item.operator} | ${item.action}`);
    if (item.comment) {
      lines.push(`     ${item.comment}`);
    }
  }
  lines.push('');

  if (report.fieldChanges.totalChanges > 0) {
    lines.push('【字段变更记录】');
    lines.push('-' .repeat(40));
    lines.push(`总变更数: ${report.fieldChanges.totalChanges}`);
    for (const change of report.fieldChanges.changes) {
      lines.push(`  ${change.time} | ${change.operator} | ${change.field}`);
      lines.push(`     旧值: ${JSON.stringify(change.oldValue)}`);
      lines.push(`     新值: ${JSON.stringify(change.newValue)}`);
    }
    lines.push('');
  }

  lines.push('【最终状态判断】');
  lines.push('-' .repeat(40));
  lines.push(`状态: ${report.sealStatus.finalStatus.status}`);
  lines.push(`说明: ${report.sealStatus.finalStatus.reason}`);
  lines.push(`是否可以用章: ${report.sealStatus.finalStatus.canProceed ? '是' : '否'}`);
  lines.push('='.repeat(80));

  return lines.join('\n');
}

module.exports = {
  generateApplicationReport,
  generateTextReport,
};
