const moment = require('moment');
const { SETTLEMENT_STATUS } = require('./config');
const { generateId, roundAmount, formatCurrency, formatDate } = require('./utils');
const {
  calculateVendorSettlement,
  getAllVendorsForSettlement,
  getHistoricalRefunds,
  getPeriodRefunds
} = require('./business');

async function createSettlement(periodStart, periodEnd, settlementDate = null) {
  const { getDb } = require('./db');
  const db = await getDb();
  
  if (!settlementDate) {
    settlementDate = moment().format('YYYY-MM-DD');
  }
  
  const existingSettlement = db.prepare(`
    SELECT * FROM settlements 
    WHERE period_start = ? AND period_end = ?
  `).get(periodStart, periodEnd);
  
  if (existingSettlement && existingSettlement.status === SETTLEMENT_STATUS.CONFIRMED) {
    throw new Error(`该结算周期 (${periodStart} 至 ${periodEnd}) 已有已确认的结算记录`);
  }
  
  if (existingSettlement) {
    return {
      settlement: existingSettlement,
      isNew: false,
      message: '已有未确认的结算，将更新该结算'
    };
  }
  
  const settlementId = generateId();
  
  db.prepare(`
    INSERT INTO settlements (id, settlement_date, period_start, period_end, status)
    VALUES (?, ?, ?, ?, ?)
  `).run(settlementId, settlementDate, periodStart, periodEnd, SETTLEMENT_STATUS.DRAFT);
  
  const settlement = db.prepare('SELECT * FROM settlements WHERE id = ?').get(settlementId);
  
  return {
    settlement,
    isNew: true,
    message: '已创建新的结算记录'
  };
}

async function calculateSettlementPreview(settlementId) {
  const { getDb } = require('./db');
  const db = await getDb();
  
  const settlement = db.prepare('SELECT * FROM settlements WHERE id = ?').get(settlementId);
  if (!settlement) {
    throw new Error(`结算记录不存在: ${settlementId}`);
  }
  
  db.prepare('DELETE FROM settlement_items WHERE settlement_id = ?').run(settlementId);
  
  const vendors = await getAllVendorsForSettlement();
  const previewItems = [];
  let grandTotalSales = 0;
  let grandTotalRefunds = 0;
  let grandTotalCommission = 0;
  let grandTotalDue = 0;
  
  for (const vendor of vendors) {
    try {
      const settlementData = await calculateVendorSettlement(
        vendor.id,
        settlement.period_start,
        settlement.period_end,
        settlement.settlement_date
      );
      
      if (settlementData.total_sales === 0 && 
          settlementData.total_refunds === 0 && 
          settlementData.deposit_amount === 0 &&
          settlementData.electricity_fee === 0) {
        continue;
      }
      
      const historicalRefunds = await getHistoricalRefunds(vendor.id, settlement.period_start);
      if (historicalRefunds.length > 0) {
        let historicalRefundTotal = 0;
        for (const hr of historicalRefunds) {
          historicalRefundTotal = roundAmount(historicalRefundTotal + hr.amount);
        }
        settlementData.total_refunds = roundAmount(settlementData.total_refunds + historicalRefundTotal);
        settlementData.net_sales = roundAmount(settlementData.total_sales - settlementData.total_refunds);
        settlementData.amount_due = roundAmount(
          settlementData.net_sales - 
          settlementData.commission_amount - 
          settlementData.deposit_amount - 
          settlementData.electricity_fee - 
          settlementData.previous_payments
        );
      }
      
      const itemId = generateId();
      const primaryBooth = settlementData.booths.length > 0 ? settlementData.booths[0].booth_id : null;
      
      const boothDetails = JSON.stringify(settlementData.booths);
      
      db.prepare(`
        INSERT INTO settlement_items (
          id, settlement_id, vendor_id, booth_id,
          total_sales, total_refunds, net_sales,
          commission_amount, deposit_amount, electricity_fee,
          previous_payments, amount_due, booth_details
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        itemId,
        settlementId,
        vendor.id,
        primaryBooth,
        settlementData.total_sales,
        settlementData.total_refunds,
        settlementData.net_sales,
        settlementData.commission_amount,
        settlementData.deposit_amount,
        settlementData.electricity_fee,
        settlementData.previous_payments,
        settlementData.amount_due,
        boothDetails
      );
      
      previewItems.push({
        ...settlementData,
        settlement_item_id: itemId
      });
      
      grandTotalSales = roundAmount(grandTotalSales + settlementData.total_sales);
      grandTotalRefunds = roundAmount(grandTotalRefunds + settlementData.total_refunds);
      grandTotalCommission = roundAmount(grandTotalCommission + settlementData.commission_amount);
      grandTotalDue = roundAmount(grandTotalDue + settlementData.amount_due);
    } catch (e) {
      console.error(`计算摊主 ${vendor.name} 结算失败:`, e.message);
    }
  }
  
  db.prepare(`
    UPDATE settlements SET status = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(SETTLEMENT_STATUS.PREVIEWED, settlementId);
  
  return {
    settlement,
    items: previewItems,
    summary: {
      total_vendors: previewItems.length,
      total_sales: grandTotalSales,
      total_refunds: grandTotalRefunds,
      total_commission: grandTotalCommission,
      total_due: grandTotalDue
    }
  };
}

async function adjustSettlementItem(itemId, adjustmentType, amount, reason, note = '') {
  const { getDb } = require('./db');
  const db = await getDb();
  
  const item = db.prepare('SELECT * FROM settlement_items WHERE id = ?').get(itemId);
  if (!item) {
    throw new Error(`结算明细不存在: ${itemId}`);
  }
  
  const settlement = db.prepare('SELECT * FROM settlements WHERE id = ?').get(item.settlement_id);
  if (settlement.status === SETTLEMENT_STATUS.CONFIRMED) {
    throw new Error('已确认的结算不能再调整');
  }
  
  const adjustmentId = generateId();
  db.prepare(`
    INSERT INTO settlement_adjustments (id, settlement_item_id, adjustment_type, amount, reason, note)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(adjustmentId, itemId, adjustmentType, amount, reason, note);
  
  const newAmountDue = roundAmount(item.amount_due + amount);
  
  const existingNote = item.adjustment_note || '';
  const adjustmentNote = `[${moment().format('YYYY-MM-DD HH:mm')}] ${adjustmentType}: ${amount > 0 ? '+' : ''}${amount} (${reason})${note ? ` - ${note}` : ''}`;
  const newNote = existingNote ? `${existingNote}\n${adjustmentNote}` : adjustmentNote;
  
  db.prepare(`
    UPDATE settlement_items 
    SET amount_due = ?, adjustment_note = ?
    WHERE id = ?
  `).run(newAmountDue, newNote, itemId);
  
  return {
    success: true,
    message: `已添加调整: ${adjustmentType} ${amount}`,
    previous_amount: item.amount_due,
    new_amount: newAmountDue
  };
}

async function confirmSettlement(settlementId) {
  const { getDb } = require('./db');
  const db = await getDb();
  
  const settlement = db.prepare('SELECT * FROM settlements WHERE id = ?').get(settlementId);
  if (!settlement) {
    throw new Error(`结算记录不存在: ${settlementId}`);
  }
  
  if (settlement.status === SETTLEMENT_STATUS.CONFIRMED) {
    return {
      success: true,
      message: '该结算已经确认过了',
      alreadyConfirmed: true
    };
  }
  
  const items = db.prepare('SELECT * FROM settlement_items WHERE settlement_id = ?').all(settlementId);
  
  const allHistoricalRefunds = [];
  const allPeriodRefunds = [];
  
  for (const item of items) {
    const historicalRefunds = await getHistoricalRefunds(item.vendor_id, settlement.period_start);
    for (const hr of historicalRefunds) {
      allHistoricalRefunds.push({
        vendorItem: item,
        refund: hr
      });
    }
    
    const periodRefunds = await getPeriodRefunds(item.vendor_id, settlement.period_start, settlement.period_end);
    for (const pr of periodRefunds) {
      allPeriodRefunds.push({
        vendorItem: item,
        refund: pr
      });
    }
  }
  
  db.transaction(() => {
    db.prepare(`
      UPDATE settlements 
      SET status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(SETTLEMENT_STATUS.CONFIRMED, settlementId);
    
    for (const item of allPeriodRefunds) {
      db.prepare(`
        INSERT INTO settlement_refunds (id, settlement_id, settlement_item_id, refund_id, is_historical)
        VALUES (?, ?, ?, ?, ?)
      `).run(
        generateId(),
        settlementId,
        item.vendorItem.id,
        item.refund.id,
        0
      );
    }
    
    for (const item of allHistoricalRefunds) {
      db.prepare(`
        INSERT INTO historical_refunds (id, refund_id, original_settlement_id, new_settlement_id, amount)
        VALUES (?, ?, ?, ?, ?)
      `).run(
        generateId(),
        item.refund.id,
        item.refund.settlement_id,
        settlementId,
        item.refund.amount
      );
      
      db.prepare(`
        INSERT INTO settlement_refunds (id, settlement_id, settlement_item_id, refund_id, is_historical)
        VALUES (?, ?, ?, ?, ?)
      `).run(
        generateId(),
        settlementId,
        item.vendorItem.id,
        item.refund.id,
        1
      );
    }
  });
  
  return {
    success: true,
    message: '结算已确认',
    settlementId,
    itemCount: items.length
  };
}

async function getSettlementById(settlementId) {
  const { getDb } = require('./db');
  const db = await getDb();
  
  const settlement = db.prepare('SELECT * FROM settlements WHERE id = ?').get(settlementId);
  if (!settlement) return null;
  
  const items = db.prepare(`
    SELECT si.*, v.name as vendor_name, b.booth_number
    FROM settlement_items si
    LEFT JOIN vendors v ON si.vendor_id = v.id
    LEFT JOIN booths b ON si.booth_id = b.id
    WHERE si.settlement_id = ?
    ORDER BY v.name
  `).all(settlementId);
  
  for (const item of items) {
    if (item.booth_details) {
      try {
        item.booths = JSON.parse(item.booth_details);
      } catch (e) {
        item.booths = [];
      }
    } else {
      item.booths = [];
    }
    
    item.adjustments = db.prepare(`
      SELECT * FROM settlement_adjustments 
      WHERE settlement_item_id = ?
      ORDER BY created_at
    `).all(item.id);
    
    item.settlement_refunds = db.prepare(`
      SELECT sr.*, r.amount as refund_amount, r.refund_date, r.reason, r.note
      FROM settlement_refunds sr
      JOIN refunds r ON sr.refund_id = r.id
      WHERE sr.settlement_item_id = ?
      ORDER BY r.refund_date
    `).all(item.id);
  }
  
  let totalSales = 0;
  let totalRefunds = 0;
  let totalCommission = 0;
  let totalDue = 0;
  
  for (const item of items) {
    totalSales = roundAmount(totalSales + item.total_sales);
    totalRefunds = roundAmount(totalRefunds + item.total_refunds);
    totalCommission = roundAmount(totalCommission + item.commission_amount);
    totalDue = roundAmount(totalDue + item.amount_due);
  }
  
  return {
    settlement,
    items,
    summary: {
      total_vendors: items.length,
      total_sales: totalSales,
      total_refunds: totalRefunds,
      total_commission: totalCommission,
      total_due: totalDue
    }
  };
}

async function getSettlementHistory(options = {}) {
  const { getDb } = require('./db');
  const db = await getDb();
  
  let query = 'SELECT * FROM settlements WHERE 1=1';
  const params = [];
  
  if (options.status) {
    query += ' AND status = ?';
    params.push(options.status);
  }
  
  if (options.startDate) {
    query += ' AND settlement_date >= ?';
    params.push(options.startDate);
  }
  
  if (options.endDate) {
    query += ' AND settlement_date <= ?';
    params.push(options.endDate);
  }
  
  query += ' ORDER BY settlement_date DESC';
  
  if (options.limit) {
    query += ` LIMIT ${options.limit}`;
  }
  
  const settlements = db.prepare(query).all(...params);
  
  return settlements;
}

async function getVendorSettlementHistory(vendorId) {
  const { getDb } = require('./db');
  const db = await getDb();
  
  const settlements = db.prepare(`
    SELECT s.*, si.amount_due, si.total_sales, si.commission_amount
    FROM settlements s
    JOIN settlement_items si ON s.id = si.settlement_id
    WHERE si.vendor_id = ? AND s.status = ?
    ORDER BY s.settlement_date DESC
  `).all(vendorId, SETTLEMENT_STATUS.CONFIRMED);
  
  return settlements;
}

async function deleteDraftSettlement(settlementId) {
  const { getDb } = require('./db');
  const db = await getDb();
  
  const settlement = db.prepare('SELECT * FROM settlements WHERE id = ?').get(settlementId);
  if (!settlement) {
    throw new Error(`结算记录不存在: ${settlementId}`);
  }
  
  if (settlement.status === SETTLEMENT_STATUS.CONFIRMED) {
    throw new Error('已确认的结算不能删除');
  }
  
  db.transaction(() => {
    db.prepare('DELETE FROM settlement_refunds WHERE settlement_id = ?').run(settlementId);
    db.prepare('DELETE FROM settlement_adjustments WHERE settlement_item_id IN (SELECT id FROM settlement_items WHERE settlement_id = ?)').run(settlementId);
    db.prepare('DELETE FROM settlement_items WHERE settlement_id = ?').run(settlementId);
    db.prepare('DELETE FROM settlements WHERE id = ?').run(settlementId);
  });
  
  return { success: true, message: '已删除结算草稿' };
}

module.exports = {
  createSettlement,
  calculateSettlementPreview,
  adjustSettlementItem,
  confirmSettlement,
  getSettlementById,
  getSettlementHistory,
  getVendorSettlementHistory,
  deleteDraftSettlement
};
