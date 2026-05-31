import { StateTransition, FreezeStatus, AccountFreezeRecord, FreezeReason } from '../types';

const HIGH_RISK_THRESHOLD = 80;
const MEDIUM_RISK_THRESHOLD = 50;

export const stateTransitions: StateTransition[] = [
  {
    from: FreezeStatus.PENDING_REVIEW,
    to: FreezeStatus.AUTO_FREEZE_APPROVED,
    condition: (record: AccountFreezeRecord) => {
      const hasHighRisk = (record.riskScore ?? 0) >= HIGH_RISK_THRESHOLD;
      const isFraudOrLegal = 
        record.freezeReason === FreezeReason.FRAUD_SUSPECTED ||
        record.freezeReason === FreezeReason.LEGAL_REQUIREMENT;
      return hasHighRisk && isFraudOrLegal;
    },
    decisionReason: (record: AccountFreezeRecord) => 
      `风险评分${record.riskScore}分（阈值${HIGH_RISK_THRESHOLD}分），冻结原因为${record.freezeReason}，符合自动冻结审批条件`,
    nextStep: () => '系统自动执行账户冻结操作',
    nextStepOwner: () => '系统自动处理'
  },
  {
    from: FreezeStatus.PENDING_REVIEW,
    to: FreezeStatus.AUTO_FREEZE_REJECTED,
    condition: (record: AccountFreezeRecord) => {
      const hasLowRisk = (record.riskScore ?? 0) < MEDIUM_RISK_THRESHOLD;
      const isManualRequest = record.freezeReason === FreezeReason.MANUAL_REQUEST;
      return hasLowRisk && !isManualRequest;
    },
    decisionReason: (record: AccountFreezeRecord) => 
      `风险评分${record.riskScore}分（低于阈值${MEDIUM_RISK_THRESHOLD}分），冻结原因为${record.freezeReason}，不符合冻结条件`,
    nextStep: () => '记录拒绝原因并关闭冻结申请',
    nextStepOwner: () => '系统自动处理'
  },
  {
    from: FreezeStatus.PENDING_REVIEW,
    to: FreezeStatus.MANUAL_REVIEW_REQUIRED,
    condition: (record: AccountFreezeRecord) => {
      const riskScore = record.riskScore ?? 0;
      const isMediumRisk = riskScore >= MEDIUM_RISK_THRESHOLD && riskScore < HIGH_RISK_THRESHOLD;
      const isAbnormalActivity = record.freezeReason === FreezeReason.ABNORMAL_ACTIVITY;
      const isRiskAlert = record.freezeReason === FreezeReason.RISK_ALERT;
      return isMediumRisk || isAbnormalActivity || isRiskAlert;
    },
    decisionReason: (record: AccountFreezeRecord) => 
      `风险评分${record.riskScore}分（中等风险区间${MEDIUM_RISK_THRESHOLD}-${HIGH_RISK_THRESHOLD}），冻结原因为${record.freezeReason}，需人工审核确认`,
    nextStep: () => '分配至风控专员进行人工审核，确认是否需要冻结',
    nextStepOwner: () => '风控审核组'
  },
  {
    from: FreezeStatus.PENDING_REVIEW,
    to: FreezeStatus.MANUAL_REVIEW_REQUIRED,
    condition: (record: AccountFreezeRecord) => {
      return !!record.parameterValidationIssues && record.parameterValidationIssues.length > 0;
    },
    decisionReason: (record: AccountFreezeRecord) => 
      `客户端参数存在${record.parameterValidationIssues?.length ?? 0}个问题，需要人工核实参数完整性`,
    nextStep: () => '联系相关人员补充或确认参数信息后继续审核',
    nextStepOwner: () => '技术支持组'
  },
  {
    from: FreezeStatus.AUTO_FREEZE_APPROVED,
    to: FreezeStatus.FROZEN,
    condition: () => true,
    decisionReason: () => '自动冻结审批通过，执行冻结操作',
    nextStep: () => '账户已冻结，监控账户活动，等待解冻申请',
    nextStepOwner: () => '系统自动处理'
  },
  {
    from: FreezeStatus.AUTO_FREEZE_REJECTED,
    to: FreezeStatus.CANCELLED,
    condition: () => true,
    decisionReason: () => '自动审核不通过，冻结申请取消',
    nextStep: () => '冻结流程结束，记录归档',
    nextStepOwner: () => '系统自动处理'
  }
];

export function findNextTransition(record: AccountFreezeRecord): StateTransition | undefined {
  return stateTransitions.find(t => 
    t.from === record.status && t.condition(record)
  );
}

export function getStatusDisplayName(status: FreezeStatus): string {
  const statusNames: Record<FreezeStatus, string> = {
    [FreezeStatus.PENDING_REVIEW]: '待审核',
    [FreezeStatus.AUTO_FREEZE_APPROVED]: '自动冻结通过',
    [FreezeStatus.AUTO_FREEZE_REJECTED]: '自动冻结拒绝',
    [FreezeStatus.MANUAL_REVIEW_REQUIRED]: '需人工审核',
    [FreezeStatus.FROZEN]: '已冻结',
    [FreezeStatus.UNFROZEN]: '已解冻',
    [FreezeStatus.CANCELLED]: '已取消',
    [FreezeStatus.ERROR]: '错误'
  };
  return statusNames[status] || status;
}

export function getReasonDisplayName(reason: FreezeReason): string {
  const reasonNames: Record<FreezeReason, string> = {
    [FreezeReason.FRAUD_SUSPECTED]: '涉嫌欺诈',
    [FreezeReason.RISK_ALERT]: '风险告警',
    [FreezeReason.COMPLIANCE_VIOLATION]: '合规违规',
    [FreezeReason.MANUAL_REQUEST]: '人工申请',
    [FreezeReason.ABNORMAL_ACTIVITY]: '异常活动',
    [FreezeReason.LEGAL_REQUIREMENT]: '司法要求'
  };
  return reasonNames[reason] || reason;
}
