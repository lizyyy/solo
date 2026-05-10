const db = require('./database');
const { v4: uuidv4 } = require('uuid');
const { RuleViolation, ValidationError } = require('./rules');
const issueTracker = require('./issue-tracker');
const campgroundService = require('./campground-service');

function checkOut(stayId, checkOutTime) {
  const now = Date.now();
  const effectiveCheckOut = checkOutTime || now;
  
  const stay = db.prepare('SELECT * FROM stays WHERE id = ?').get(stayId);
  if (!stay) {
    throw new ValidationError(`入住记录 ${stayId} 不存在`, 'stay_id');
  }
  
  if (stay.status !== 'CHECKED_IN') {
    throw new ValidationError(`入住记录 ${stayId} 状态为 ${stay.status}，无法退营`, 'stay_id');
  }
  
  if (effectiveCheckOut < stay.check_in_time) {
    throw new ValidationError('退营时间不能早于入住时间', 'check_out_time');
  }
  
  db.prepare(`
    UPDATE stays 
    SET check_out_time = ?, status = 'CHECKED_OUT'
    WHERE id = ?
  `).run(effectiveCheckOut, stayId);
  
  const pillars = campgroundService.getSpotConnectedPillars(stay.spot_id);
  
  for (const pillar of pillars) {
    const lastReading = campgroundService.getPillarLastReading(pillar.id);
    if (!lastReading) continue;
    
    const allocationsBefore = db.prepare(`
      SELECT to_reading_id FROM utility_allocations 
      WHERE stay_id = ? AND pillar_id = ?
      ORDER BY created_at DESC
      LIMIT 1
    `).get(stayId, pillar.id);
    
    let fromReadingId = null;
    if (allocationsBefore) {
      fromReadingId = allocationsBefore.to_reading_id;
    }
    
    if (lastReading.id !== fromReadingId) {
      try {
        campgroundService.allocateUtilityUsage(
          pillar.id,
          fromReadingId,
          lastReading.id,
          'CHECKOUT',
          stayId
        );
      } catch (e) {
        issueTracker.createIssueFromError(e, 'CHECKOUT', stayId, { stayId, pillarId: pillar.id });
      }
    }
  }
  
  return {
    id: stayId,
    check_out_time: effectiveCheckOut,
    status: 'CHECKED_OUT'
  };
}

function calculateSettlement(stayId) {
  const stay = db.prepare('SELECT * FROM stays WHERE id = ?').get(stayId);
  if (!stay) {
    throw new ValidationError(`入住记录 ${stayId} 不存在`, 'stay_id');
  }
  
  const summary = campgroundService.getStaySummary(stayId);
  const totalUtilityCost = summary.totals.total_utility_cost;
  const depositAmount = stay.deposit_amount;
  
  const discrepancy = totalUtilityCost - depositAmount;
  let refundAmount = 0;
  let additionalCharge = 0;
  let depositUsed = 0;
  let discrepancyReason = null;
  
  if (discrepancy <= 0) {
    depositUsed = totalUtilityCost;
    refundAmount = Math.abs(discrepancy);
  } else {
    depositUsed = depositAmount;
    additionalCharge = discrepancy;
    discrepancyReason = `押金不足：押金 ${depositAmount} 分 < 实际费用 ${totalUtilityCost} 分，需补缴 ${additionalCharge} 分`;
  }
  
  return {
    stayId,
    total_utility_cost: totalUtilityCost,
    deposit_amount: depositAmount,
    deposit_used: depositUsed,
    refund_amount: refundAmount,
    additional_charge: additionalCharge,
    discrepancy: discrepancy,
    discrepancy_reason: discrepancyReason,
    allocations: summary.allocations
  };
}

function createSettlement(stayId) {
  const stay = db.prepare('SELECT * FROM stays WHERE id = ?').get(stayId);
  if (!stay) {
    throw new ValidationError(`入住记录 ${stayId} 不存在`, 'stay_id');
  }
  
  const existing = db.prepare(`
    SELECT * FROM settlements WHERE stay_id = ? AND status IN ('DRAFT', 'CONFIRMED')
  `).get(stayId);
  
  if (existing) {
    return {
      ...existing,
      note: '已有未完成的结算记录'
    };
  }
  
  const calc = calculateSettlement(stayId);
  const now = Date.now();
  const settlementId = uuidv4();
  
  db.prepare(`
    INSERT INTO settlements
      (id, stay_id, total_utility_cost, deposit_used, refund_amount, 
       additional_charge, status, discrepancy_reason, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 'DRAFT', ?, ?)
  `).run(
    settlementId,
    stayId,
    calc.total_utility_cost,
    calc.deposit_used,
    calc.refund_amount,
    calc.additional_charge,
    calc.discrepancy_reason,
    now
  );
  
  if (calc.additional_charge > 0) {
    issueTracker.createIssue(
      issueTracker.ISSUE_TYPES.DEPOSIT_SHORTAGE,
      'SETTLEMENT',
      settlementId,
      { stayId, ...calc },
      `退营结算时押金不足：需补缴 ${calc.additional_charge} 分`,
      issueTracker.SEVERITY.HIGH
    );
  }
  
  return {
    id: settlementId,
    stay_id: stayId,
    total_utility_cost: calc.total_utility_cost,
    deposit_amount: calc.deposit_amount,
    deposit_used: calc.deposit_used,
    refund_amount: calc.refund_amount,
    additional_charge: calc.additional_charge,
    discrepancy_reason: calc.discrepancy_reason,
    status: 'DRAFT'
  };
}

function confirmSettlement(settlementId, paymentReference = null) {
  const settlement = db.prepare('SELECT * FROM settlements WHERE id = ?').get(settlementId);
  if (!settlement) {
    throw new ValidationError(`结算记录 ${settlementId} 不存在`, 'settlement_id');
  }
  
  if (settlement.status === 'CONFIRMED') {
    return {
      ...settlement,
      note: '结算已确认'
    };
  }
  
  if (settlement.additional_charge > 0 && !paymentReference) {
    throw new RuleViolation(
      'R008',
      `押金不足需补缴 ${settlement.additional_charge} 分，必须提供支付凭证`,
      'SETTLEMENT',
      settlementId
    );
  }
  
  const now = Date.now();
  
  db.prepare(`
    UPDATE settlements 
    SET status = 'CONFIRMED' 
    WHERE id = ?
  `).run(settlementId);
  
  return {
    ...settlement,
    status: 'CONFIRMED',
    payment_reference: paymentReference,
    confirmed_at: now
  };
}

function getSettlementByStay(stayId) {
  return db.prepare(`
    SELECT * FROM settlements WHERE stay_id = ? ORDER BY created_at DESC
  `).all(stayId);
}

function getSettlement(settlementId) {
  return db.prepare('SELECT * FROM settlements WHERE id = ?').get(settlementId);
}

function getFullStayDetails(stayId) {
  const stay = db.prepare('SELECT * FROM stays WHERE id = ?').get(stayId);
  if (!stay) return null;
  
  const summary = campgroundService.getStaySummary(stayId);
  const settlements = getSettlementByStay(stayId);
  const allocations = summary.allocations;
  
  const allocationDetails = allocations.map(alloc => {
    const fromReading = alloc.from_reading_id 
      ? db.prepare('SELECT * FROM meter_readings WHERE id = ?').get(alloc.from_reading_id)
      : null;
    const toReading = db.prepare('SELECT * FROM meter_readings WHERE id = ?').get(alloc.to_reading_id);
    
    return {
      allocation: alloc,
      from_reading: fromReading,
      to_reading: toReading,
      from_time: fromReading ? new Date(fromReading.reading_time).toISOString() : '首次',
      to_time: new Date(toReading.reading_time).toISOString()
    };
  });
  
  return {
    stay: {
      ...stay,
      check_in_time_iso: new Date(stay.check_in_time).toISOString(),
      check_out_time_iso: stay.check_out_time ? new Date(stay.check_out_time).toISOString() : null
    },
    summary: {
      ...summary.totals,
      total_utility_cost_yuan: (summary.totals.total_utility_cost / 100).toFixed(2),
      deposit_amount_yuan: (summary.totals.deposit_amount / 100).toFixed(2),
      balance_yuan: (summary.totals.balance / 100).toFixed(2)
    },
    allocations: allocationDetails,
    settlements
  };
}

module.exports = {
  checkOut,
  calculateSettlement,
  createSettlement,
  confirmSettlement,
  getSettlementByStay,
  getSettlement,
  getFullStayDetails
};
