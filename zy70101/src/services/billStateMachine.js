const BILL_STATUS = {
  PENDING_GENERATION: 'pending_generation',
  GENERATED: 'generated',
  PENDING_CONFIRMATION: 'pending_confirmation',
  CONFIRMED: 'confirmed',
  DISPUTED: 'disputed',
  DISPUTE_RESOLVED: 'dispute_resolved',
  PENDING_RECALCULATION: 'pending_recalculation',
  RECALCULATING: 'recalculating',
  RECALCULATION_FAILED: 'recalculation_failed'
};

const ALLOWED_TRANSITIONS = {
  [BILL_STATUS.PENDING_GENERATION]: [BILL_STATUS.GENERATED],
  [BILL_STATUS.GENERATED]: [BILL_STATUS.PENDING_CONFIRMATION, BILL_STATUS.PENDING_RECALCULATION],
  [BILL_STATUS.PENDING_CONFIRMATION]: [BILL_STATUS.CONFIRMED, BILL_STATUS.DISPUTED, BILL_STATUS.PENDING_RECALCULATION],
  [BILL_STATUS.CONFIRMED]: [BILL_STATUS.PENDING_RECALCULATION],
  [BILL_STATUS.DISPUTED]: [BILL_STATUS.DISPUTE_RESOLVED],
  [BILL_STATUS.DISPUTE_RESOLVED]: [BILL_STATUS.PENDING_CONFIRMATION, BILL_STATUS.PENDING_RECALCULATION],
  [BILL_STATUS.PENDING_RECALCULATION]: [BILL_STATUS.RECALCULATING],
  [BILL_STATUS.RECALCULATING]: [BILL_STATUS.GENERATED, BILL_STATUS.RECALCULATION_FAILED],
  [BILL_STATUS.RECALCULATION_FAILED]: [BILL_STATUS.RECALCULATING, BILL_STATUS.PENDING_RECALCULATION]
};

const STATUS_DESCRIPTIONS = {
  [BILL_STATUS.PENDING_GENERATION]: '账单待生成',
  [BILL_STATUS.GENERATED]: '账单已生成',
  [BILL_STATUS.PENDING_CONFIRMATION]: '账单待确认',
  [BILL_STATUS.CONFIRMED]: '账单已确认',
  [BILL_STATUS.DISPUTED]: '异议处理中',
  [BILL_STATUS.DISPUTE_RESOLVED]: '异议已处理',
  [BILL_STATUS.PENDING_RECALCULATION]: '待重算',
  [BILL_STATUS.RECALCULATING]: '重算中',
  [BILL_STATUS.RECALCULATION_FAILED]: '重算失败'
};

const TRANSITION_ERRORS = {
  [`${BILL_STATUS.CONFIRMED}->${BILL_STATUS.DISPUTED}`]: '账单已确认，不能再提异议，请走重算流程',
  [`${BILL_STATUS.DISPUTED}->${BILL_STATUS.CONFIRMED}`]: '当前有未处理的异议，请先处理异议',
  [`${BILL_STATUS.GENERATED}->${BILL_STATUS.CONFIRMED}`]: '账单需要先提交待确认后才能确认',
  [`${BILL_STATUS.PENDING_CONFIRMATION}->${BILL_STATUS.GENERATED}`]: '账单已提交待确认，不能退回已生成状态'
};

function canTransition(fromStatus, toStatus) {
  if (!ALLOWED_TRANSITIONS[fromStatus]) {
    return { allowed: false, reason: `未知的账单状态: ${fromStatus}` };
  }
  if (!ALLOWED_TRANSITIONS[fromStatus].includes(toStatus)) {
    const specificError = TRANSITION_ERRORS[`${fromStatus}->${toStatus}`];
    if (specificError) {
      return { allowed: false, reason: specificError };
    }
    const fromDesc = STATUS_DESCRIPTIONS[fromStatus] || fromStatus;
    const toDesc = STATUS_DESCRIPTIONS[toStatus] || toStatus;
    return { allowed: false, reason: `状态流转不合法: 不能从【${fromDesc}】直接流转到【${toDesc}】` };
  }
  return { allowed: true };
}

function describeStatus(status) {
  return STATUS_DESCRIPTIONS[status] || status;
}

function describeAvailableTransitions(status) {
  const transitions = ALLOWED_TRANSITIONS[status] || [];
  return transitions.map(t => ({
    status: t,
    description: STATUS_DESCRIPTIONS[t] || t
  }));
}

module.exports = {
  BILL_STATUS,
  STATUS_DESCRIPTIONS,
  canTransition,
  describeStatus,
  describeAvailableTransitions
};
