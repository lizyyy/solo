const {
  store,
  STATUS,
  createGift,
  createSettlement,
  addAuditLog,
  findSettlementByPeriodAndAnchor,
  findActiveFreeze,
  findActiveRule,
  getPreviousSettlement
} = require('../models/store');

function round2(num) {
  return Math.round(num * 100) / 100;
}

function processGiftWithIdempotency(giftData) {
  const giftKey = `${giftData.streamerId}-${giftData.giftType}-${giftData.amount}-${giftData.timestamp}`;
  const existingGift = Object.values(store.gifts).find(g => g.idempotencyKey === giftKey);
  
  if (existingGift) {
    addAuditLog('IDEMPOTENT_DUPLICATE', 'GIFT', existingGift.id, {
      reason: 'Same gift already processed',
      duplicateGiftKey: giftKey
    });
    return { gift: existingGift, isDuplicate: true };
  }
  
  if (giftData.id && store.gifts[giftData.id]) {
    addAuditLog('IDEMPOTENT_DUPLICATE', 'GIFT', giftData.id, {
      reason: 'Gift ID already exists'
    });
    return { gift: store.gifts[giftData.id], isDuplicate: true };
  }
  
  const gift = createGift(giftData);
  addAuditLog('GIFT_CREATED', 'GIFT', gift.id, {
    streamerId: gift.streamerId,
    totalValue: gift.totalValue
  });
  
  return { gift, isDuplicate: false };
}

function calculateShare(giftValue, rule, isFrozen) {
  if (isFrozen) {
    return {
      anchor: 0,
      guild: 0,
      platform: 0,
      frozen: giftValue
    };
  }
  
  const anchor = round2(giftValue * rule.anchorRatio);
  const guild = round2(giftValue * rule.guildRatio);
  const platform = round2(giftValue * rule.platformRatio);
  
  const total = round2(anchor + guild + platform);
  const diff = round2(giftValue - total);
  
  if (diff !== 0) {
    if (diff > 0) {
      return {
        anchor: round2(anchor + diff),
        guild,
        platform,
        frozen: 0
      };
    } else {
      return {
        anchor: round2(anchor + diff),
        guild,
        platform,
        frozen: 0
      };
    }
  }
  
  return { anchor, guild, platform, frozen: 0 };
}

function getSettlementPeriod(timestamp) {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = date.getDate();
  const half = day <= 15 ? '01' : '16';
  return `${year}-${month}-${half}`;
}

function addHistory(settlement, event, details, operator = 'SYSTEM') {
  settlement.history.push({
    event,
    details,
    operator,
    timestamp: new Date().toISOString(),
    statusBefore: settlement.status
  });
  settlement.updatedAt = new Date().toISOString();
}

function updateStatus(settlement, newStatus, reason) {
  const oldStatus = settlement.status;
  settlement.status = newStatus;
  addHistory(settlement, 'STATUS_CHANGE', {
    from: oldStatus,
    to: newStatus,
    reason
  });
  addAuditLog('SETTLEMENT_STATUS_CHANGE', 'SETTLEMENT', settlement.id, {
    from: oldStatus,
    to: newStatus,
    reason
  });
}

function createSettlementForPeriod(period, anchorId) {
  const existing = findSettlementByPeriodAndAnchor(period, anchorId);
  if (existing) {
    return existing;
  }
  
  const settlement = createSettlement(period, anchorId);
  addAuditLog('SETTLEMENT_CREATED', 'SETTLEMENT', settlement.id, {
    period,
    anchorId
  });
  return settlement;
}

function processGiftToSettlement(gift) {
  const period = gift.settlementPeriod || getSettlementPeriod(gift.timestamp);
  const anchor = store.anchors[gift.streamerId];
  
  if (!anchor) {
    throw new Error(`Anchor ${gift.streamerId} not found`);
  }
  
  const settlement = createSettlementForPeriod(period, gift.streamerId);
  
  if (gift.settlementId === settlement.id) {
    return settlement;
  }
  
  const rule = findActiveRule(
    gift.streamerId,
    gift.guildId || anchor.guildId,
    gift.timestamp
  );
  
  if (!rule) {
    updateStatus(settlement, STATUS.SETTLEMENT.FAILED, 
      `No active settlement rule found for gift ${gift.id}`);
    throw new Error(`No active settlement rule for anchor ${gift.streamerId}`);
  }
  
  const freeze = findActiveFreeze(gift.streamerId, gift.timestamp);
  const isFrozen = !!freeze;
  
  const share = calculateShare(gift.totalValue, rule, isFrozen);
  
  settlement.giftIds.push(gift.id);
  gift.settlementId = settlement.id;
  
  if (isFrozen) {
    gift.status = STATUS.GIFT.FROZEN;
    settlement.freezeIds.push(freeze.id);
    freeze.affectedGifts.push(gift.id);
    freeze.affectedAmount = round2(freeze.affectedAmount + gift.totalValue);
  } else {
    gift.status = STATUS.GIFT.SETTLED;
  }
  
  settlement.calculations.totalGiftValue = round2(
    settlement.calculations.totalGiftValue + gift.totalValue
  );
  settlement.calculations.anchorShare = round2(
    settlement.calculations.anchorShare + share.anchor
  );
  settlement.calculations.guildShare = round2(
    settlement.calculations.guildShare + share.guild
  );
  settlement.calculations.platformShare = round2(
    settlement.calculations.platformShare + share.platform
  );
  settlement.calculations.freezeAmount = round2(
    settlement.calculations.freezeAmount + share.frozen
  );
  
  addHistory(settlement, 'GIFT_ADDED', {
    giftId: gift.id,
    giftValue: gift.totalValue,
    share,
    ruleApplied: {
      anchorRatio: rule.anchorRatio,
      guildRatio: rule.guildRatio,
      platformRatio: rule.platformRatio
    },
    isFrozen
  });
  
  updateStatus(settlement, STATUS.SETTLEMENT.PARTIAL, 
    `Gift ${gift.id} processed, waiting for more gifts or finalization`);
  
  return settlement;
}

function processRefund(refund) {
  const gift = store.gifts[refund.giftId];
  if (!gift) {
    throw new Error(`Gift ${refund.giftId} not found`);
  }
  
  const refundPeriodSettlement = createSettlementForPeriod(
    refund.refundPeriod,
    gift.streamerId
  );
  
  refundPeriodSettlement.refundIds.push(refund.id);
  refund.status = 'APPLIED';
  
  const adjustment = round2(refund.amount * -1);
  refundPeriodSettlement.calculations.refundAdjustment = round2(
    refundPeriodSettlement.calculations.refundAdjustment + adjustment
  );
  
  addHistory(refundPeriodSettlement, 'REFUND_APPLIED', {
    refundId: refund.id,
    giftId: gift.id,
    originalPeriod: refund.originalPeriod,
    refundAmount: refund.amount,
    adjustment
  });
  
  addAuditLog('REFUND_PROCESSED', 'REFUND', refund.id, {
    giftId: gift.id,
    originalPeriod: refund.originalPeriod,
    refundPeriod: refund.refundPeriod,
    amount: refund.amount
  });
  
  return refundPeriodSettlement;
}

function applyCarryover(settlement) {
  const previous = getPreviousSettlement(settlement.anchorId, settlement.period);
  
  if (previous) {
    settlement.calculations.previousCarryover = previous.calculations.nextCarryover;
    addHistory(settlement, 'CARRYOVER_APPLIED', {
      previousPeriod: previous.period,
      carryoverAmount: previous.calculations.nextCarryover
    });
  }
}

function calculateFinalNet(settlement) {
  const calc = settlement.calculations;
  
  const currentNet = round2(
    calc.anchorShare + 
    calc.previousCarryover + 
    calc.refundAdjustment
  );
  
  if (currentNet < 0) {
    calc.netPayable = 0;
    calc.nextCarryover = currentNet;
    return {
      netPayable: 0,
      nextCarryover: currentNet,
      status: 'NEGATIVE_CARRIED_OVER'
    };
  }
  
  calc.netPayable = currentNet;
  calc.nextCarryover = 0;
  return {
    netPayable: currentNet,
    nextCarryover: 0,
    status: 'NORMAL'
  };
}

function finalizeSettlement(settlementId) {
  const settlement = store.settlements[settlementId];
  if (!settlement) {
    throw new Error(`Settlement ${settlementId} not found`);
  }
  
  if (settlement.status === STATUS.SETTLEMENT.COMPLETED) {
    addHistory(settlement, 'REPEAT_FINALIZE', {
      note: 'Idempotent: already completed'
    });
    return settlement;
  }
  
  updateStatus(settlement, STATUS.SETTLEMENT.PROCESSING, 'Starting finalization');
  
  applyCarryover(settlement);
  
  const pendingRefunds = Object.values(store.refunds).filter(
    r => r.refundPeriod === settlement.period && 
         r.status === 'PENDING'
  );
  
  for (const refund of pendingRefunds) {
    processRefund(refund);
  }
  
  const result = calculateFinalNet(settlement);
  
  addHistory(settlement, 'FINAL_CALCULATION', {
    result,
    calculations: { ...settlement.calculations }
  });
  
  if (result.status === 'NEGATIVE_CARRIED_OVER') {
    updateStatus(settlement, STATUS.SETTLEMENT.COMPLETED, 
      `Settlement completed with negative carryover: ${result.nextCarryover}`);
  } else if (settlement.calculations.freezeAmount > 0) {
    updateStatus(settlement, STATUS.SETTLEMENT.FROZEN, 
      `Settlement has frozen amount: ${settlement.calculations.freezeAmount}`);
  } else {
    updateStatus(settlement, STATUS.SETTLEMENT.COMPLETED, 
      'Settlement completed successfully');
  }
  
  const anchor = store.anchors[settlement.anchorId];
  if (anchor) {
    anchor.settlementHistory.push(settlementId);
  }
  
  addAuditLog('SETTLEMENT_FINALIZED', 'SETTLEMENT', settlement.id, {
    period: settlement.period,
    netPayable: settlement.calculations.netPayable,
    freezeAmount: settlement.calculations.freezeAmount
  });
  
  return settlement;
}

function manualCorrect(settlementId, changes, operator) {
  const settlement = store.settlements[settlementId];
  if (!settlement) {
    throw new Error(`Settlement ${settlementId} not found`);
  }
  
  const before = { ...settlement.calculations };
  const corrections = [];
  
  for (const [key, value] of Object.entries(changes)) {
    if (typeof settlement.calculations[key] === 'number') {
      const oldValue = settlement.calculations[key];
      settlement.calculations[key] = round2(value);
      corrections.push({
        field: key,
        before: oldValue,
        after: value
      });
    }
  }
  
  const correctionRecord = {
    id: Date.now().toString(),
    operator,
    timestamp: new Date().toISOString(),
    corrections,
    before,
    after: { ...settlement.calculations }
  };
  
  settlement.manualCorrections.push(correctionRecord);
  
  addHistory(settlement, 'MANUAL_CORRECTION', {
    correctionId: correctionRecord.id,
    operator,
    corrections
  }, operator);
  
  addAuditLog('MANUAL_CORRECTION', 'SETTLEMENT', settlement.id, {
    corrections,
    operator,
    before,
    after: { ...settlement.calculations }
  }, operator);
  
  calculateFinalNet(settlement);
  
  return correctionRecord;
}

function generateSettlementReport(settlementId) {
  const settlement = store.settlements[settlementId];
  if (!settlement) {
    throw new Error(`Settlement ${settlementId} not found`);
  }
  
  const anchor = store.anchors[settlement.anchorId];
  const guild = anchor?.guildId ? store.guilds[anchor.guildId] : null;
  const gifts = settlement.giftIds.map(id => store.gifts[id]).filter(Boolean);
  const refunds = settlement.refundIds.map(id => store.refunds[id]).filter(Boolean);
  const freezes = settlement.freezeIds.map(id => store.freezes[id]).filter(Boolean);
  
  const calc = settlement.calculations;
  
  return {
    settlementId: settlement.id,
    period: settlement.period,
    status: settlement.status,
    anchor: anchor ? { id: anchor.id, name: anchor.name } : null,
    guild: guild ? { id: guild.id, name: guild.name } : null,
    summary: {
      totalGiftValue: calc.totalGiftValue,
      anchorShare: calc.anchorShare,
      guildShare: calc.guildShare,
      platformShare: calc.platformShare,
      refundAdjustment: calc.refundAdjustment,
      freezeAmount: calc.freezeAmount,
      previousCarryover: calc.previousCarryover,
      netPayable: calc.netPayable,
      nextCarryover: calc.nextCarryover
    },
    details: {
      giftCount: gifts.length,
      refundCount: refunds.length,
      freezeCount: freezes.length,
      gifts: gifts.map(g => ({
        id: g.id,
        type: g.giftType,
        amount: g.amount,
        value: g.totalValue,
        status: g.status,
        timestamp: g.timestamp
      })),
      refunds: refunds.map(r => ({
        id: r.id,
        giftId: r.giftId,
        amount: r.amount,
        reason: r.reason
      })),
      freezes: freezes.map(f => ({
        id: f.id,
        reason: f.reason,
        affectedAmount: f.affectedAmount
      }))
    },
    history: settlement.history,
    manualCorrections: settlement.manualCorrections,
    generatedAt: new Date().toISOString()
  };
}

function generateAnchorExplanationReport(settlementId) {
  const report = generateSettlementReport(settlementId);
  const calc = report.summary;
  
  const sections = [];
  
  sections.push({
    title: '账单概览',
    content: `账期：${report.period}\n状态：${report.status}\n主播：${report.anchor?.name || '未知'}`
  });
  
  sections.push({
    title: '礼物收入明细',
    content: `本期礼物总收入：¥${calc.totalGiftValue.toFixed(2)}\n主播分成比例：根据您与公会的协议计算\n主播分成：¥${calc.anchorShare.toFixed(2)}\n公会分成：¥${calc.guildShare.toFixed(2)}\n平台分成：¥${calc.platformShare.toFixed(2)}`
  });
  
  if (calc.freezeAmount > 0) {
    sections.push({
      title: '冻结金额',
      content: `本期冻结金额：¥${calc.freezeAmount.toFixed(2)}\n原因：存在违规记录，相关收入暂时冻结\n如有疑问，请联系平台客服申诉`
    });
  }
  
  if (calc.refundAdjustment !== 0) {
    sections.push({
      title: '退款调整',
      content: `本期退款冲抵：¥${Math.abs(calc.refundAdjustment).toFixed(2)}\n退款会从您的可提现金额中扣除`
    });
  }
  
  if (calc.previousCarryover !== 0) {
    sections.push({
      title: '上期结转',
      content: `上期结转金额：¥${calc.previousCarryover.toFixed(2)}`
    });
  }
  
  sections.push({
    title: '最终可打款金额',
    content: `可打款金额：¥${calc.netPayable.toFixed(2)}\n${calc.nextCarryover < 0 ? `负余额结转至下期：¥${Math.abs(calc.nextCarryover).toFixed(2)}` : ''}`
  });
  
  return {
    ...report,
    explanation: sections
  };
}

module.exports = {
  round2,
  getSettlementPeriod,
  processGiftWithIdempotency,
  calculateShare,
  processGiftToSettlement,
  processRefund,
  finalizeSettlement,
  manualCorrect,
  generateSettlementReport,
  generateAnchorExplanationReport,
  addHistory,
  updateStatus
};
