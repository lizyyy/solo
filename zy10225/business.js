const { SETTLEMENT_STATUS, DATA_TYPES } = require('./config');
const { generateId, roundAmount } = require('./utils');

async function getCommissionRate(vendorId, boothId, date) {
  const { getDb, loadConfig } = require('./db');
  const db = await getDb();
  
  let rateQuery = `
    SELECT * FROM commission_rates 
    WHERE (vendor_id = ? OR booth_id = ?)
    AND effective_date <= ?
    AND (end_date IS NULL OR end_date >= ?)
    ORDER BY vendor_id IS NULL ASC, booth_id IS NULL ASC, effective_date DESC
    LIMIT 1
  `;
  
  let rate = db.prepare(rateQuery).get(vendorId, boothId, date, date);
  
  if (!rate) {
    const config = loadConfig();
    return {
      rate_type: 'flat',
      flat_rate: config ? config.defaultCommissionRate : 0.1,
      tier_config: null
    };
  }
  
  return rate;
}

function calculateCommission(netSales, rateConfig) {
  if (!rateConfig) return 0;
  
  if (rateConfig.rate_type === 'flat') {
    return roundAmount(netSales * (rateConfig.flat_rate || 0));
  }
  
  if (rateConfig.rate_type === 'tiered') {
    try {
      const tiers = typeof rateConfig.tier_config === 'string' 
        ? JSON.parse(rateConfig.tier_config) 
        : rateConfig.tier_config;
      
      if (!Array.isArray(tiers) || tiers.length === 0) return 0;
      
      const sortedTiers = [...tiers].sort((a, b) => b.threshold - a.threshold);
      let commission = 0;
      let remaining = netSales;
      
      for (const tier of sortedTiers) {
        if (remaining > tier.threshold) {
          const tierAmount = remaining - tier.threshold;
          commission += tierAmount * tier.rate;
          remaining = tier.threshold;
        }
      }
      
      return roundAmount(commission);
    } catch (e) {
      console.error('解析阶梯抽成配置失败:', e);
      return roundAmount(netSales * 0.1);
    }
  }
  
  return 0;
}

async function getVendorBoothForDate(vendorId, date) {
  const { getDb } = require('./db');
  const db = await getDb();
  
  const query = `
    SELECT vba.*, b.booth_number, b.zone
    FROM vendor_booth_assignments vba
    JOIN booths b ON vba.booth_id = b.id
    WHERE vba.vendor_id = ?
    AND vba.start_date <= ?
    AND (vba.end_date IS NULL OR vba.end_date >= ?)
    ORDER BY vba.start_date DESC
    LIMIT 1
  `;
  
  return db.prepare(query).get(vendorId, date, date);
}

async function getVendorSalesByBooth(vendorId, startDate, endDate) {
  const { getDb } = require('./db');
  const db = await getDb();
  
  const query = `
    SELECT 
      booth_id,
      SUM(amount) as total_sales,
      COUNT(*) as transaction_count,
      MIN(sale_date) as first_sale_date,
      MAX(sale_date) as last_sale_date
    FROM sales_records
    WHERE vendor_id = ?
    AND sale_date >= ?
    AND sale_date <= ?
    GROUP BY booth_id
  `;
  
  return db.prepare(query).all(vendorId, startDate, endDate);
}

async function getVendorRefundsByBooth(vendorId, startDate, endDate) {
  const { getDb } = require('./db');
  const db = await getDb();
  
  const query = `
    SELECT 
      COALESCE(booth_id, (
        SELECT booth_id FROM sales_records sr 
        WHERE sr.id = related_sale_id
      )) as booth_id,
      SUM(amount) as total_refunds,
      COUNT(*) as refund_count
    FROM refunds
    WHERE vendor_id = ?
    AND refund_date >= ?
    AND refund_date <= ?
    GROUP BY booth_id
  `;
  
  return db.prepare(query).all(vendorId, startDate, endDate);
}

async function getHistoricalRefunds(vendorId, beforeDate) {
  const { getDb } = require('./db');
  const db = await getDb();
  
  const query = `
    SELECT 
      r.*,
      COALESCE(r.booth_id, (
        SELECT booth_id FROM sales_records sr 
        WHERE sr.id = r.related_sale_id
      )) as actual_booth_id,
      s.id as settlement_id,
      s.settlement_date,
      s.period_start,
      s.period_end
    FROM refunds r
    JOIN settlements s ON s.status = ?
    WHERE r.vendor_id = ?
    AND r.refund_date <= ?
    AND r.refund_date > s.period_end
    AND r.refund_date <= s.period_end + 365
    AND r.id NOT IN (
      SELECT refund_id FROM historical_refunds 
      WHERE original_settlement_id = s.id
    )
    AND (
      r.related_sale_id IS NULL
      OR EXISTS (
        SELECT 1 FROM sales_records sr 
        WHERE sr.id = r.related_sale_id
        AND sr.sale_date >= s.period_start 
        AND sr.sale_date <= s.period_end
      )
    )
    AND EXISTS (
      SELECT 1 FROM sales_records sr
      WHERE sr.vendor_id = r.vendor_id
      AND sr.sale_date >= s.period_start
      AND sr.sale_date <= s.period_end
    )
    ORDER BY r.refund_date ASC, s.period_end DESC
  `;
  
  const results = db.prepare(query).all(SETTLEMENT_STATUS.CONFIRMED, vendorId, beforeDate);
  
  const uniqueRefunds = new Map();
  for (const row of results) {
    if (!uniqueRefunds.has(row.id)) {
      uniqueRefunds.set(row.id, row);
    }
  }
  
  return Array.from(uniqueRefunds.values());
}

async function getPeriodRefunds(vendorId, periodStart, periodEnd) {
  const { getDb } = require('./db');
  const db = await getDb();
  
  const query = `
    SELECT * FROM refunds 
    WHERE vendor_id = ?
    AND refund_date >= ?
    AND refund_date <= ?
  `;
  
  return db.prepare(query).all(vendorId, periodStart, periodEnd);
}

async function getVendorDeposit(vendorId, settlementDate) {
  const { getDb } = require('./db');
  const db = await getDb();
  
  const query = `
    SELECT 
      SUM(CASE WHEN is_returned = 0 THEN amount ELSE -amount END) as net_deposit
    FROM deposits
    WHERE vendor_id = ?
    AND deposit_date <= ?
  `;
  
  const result = db.prepare(query).get(vendorId, settlementDate);
  return result ? roundAmount(result.net_deposit || 0) : 0;
}

async function getVendorElectricityFee(vendorId, startDate, endDate) {
  const { getDb } = require('./db');
  const db = await getDb();
  
  const query = `
    SELECT SUM(amount) as total_fee
    FROM electricity_fees
    WHERE vendor_id = ?
    AND fee_date >= ?
    AND fee_date <= ?
  `;
  
  const result = db.prepare(query).get(vendorId, startDate, endDate);
  return result ? roundAmount(result.total_fee || 0) : 0;
}

async function getVendorPreviousPayments(vendorId, settlementDate) {
  const { getDb } = require('./db');
  const db = await getDb();
  
  const query = `
    SELECT SUM(amount) as total_paid
    FROM payments
    WHERE vendor_id = ?
    AND payment_date <= ?
  `;
  
  const result = db.prepare(query).get(vendorId, settlementDate);
  return result ? roundAmount(result.total_paid || 0) : 0;
}

async function calculateVendorSettlement(vendorId, periodStart, periodEnd, settlementDate) {
  const { getDb } = require('./db');
  const db = await getDb();
  const vendor = db.prepare('SELECT * FROM vendors WHERE id = ?').get(vendorId);
  
  if (!vendor) {
    throw new Error(`摊主不存在: ${vendorId}`);
  }
  
  const salesByBooth = await getVendorSalesByBooth(vendorId, periodStart, periodEnd);
  const refundsByBooth = await getVendorRefundsByBooth(vendorId, periodStart, periodEnd);
  
  const boothMap = new Map();
  
  for (const sale of salesByBooth) {
    if (!boothMap.has(sale.booth_id)) {
      boothMap.set(sale.booth_id, {
        booth_id: sale.booth_id,
        total_sales: 0,
        total_refunds: 0,
        commission_rate: null
      });
    }
    const booth = boothMap.get(sale.booth_id);
    booth.total_sales = roundAmount(booth.total_sales + sale.total_sales);
  }
  
  for (const refund of refundsByBooth) {
    const boothId = refund.booth_id || Array.from(boothMap.keys())[0];
    if (boothId && !boothMap.has(boothId)) {
      boothMap.set(boothId, {
        booth_id: boothId,
        total_sales: 0,
        total_refunds: 0,
        commission_rate: null
      });
    }
    if (boothId) {
      const booth = boothMap.get(boothId);
      booth.total_refunds = roundAmount(booth.total_refunds + refund.total_refunds);
    }
  }
  
  if (boothMap.size === 0) {
    const currentBooth = await getVendorBoothForDate(vendorId, periodStart);
    if (currentBooth) {
      boothMap.set(currentBooth.booth_id, {
        booth_id: currentBooth.booth_id,
        total_sales: 0,
        total_refunds: 0,
        commission_rate: null
      });
    }
  }
  
  let totalSales = 0;
  let totalRefunds = 0;
  let totalCommission = 0;
  
  for (const [boothId, data] of boothMap) {
    const rateConfig = await getCommissionRate(vendorId, boothId, periodStart);
    data.commission_rate = rateConfig;
    
    const netSales = roundAmount(data.total_sales - data.total_refunds);
    const commission = calculateCommission(netSales, rateConfig);
    data.commission_amount = commission;
    
    totalSales = roundAmount(totalSales + data.total_sales);
    totalRefunds = roundAmount(totalRefunds + data.total_refunds);
    totalCommission = roundAmount(totalCommission + commission);
  }
  
  const netSales = roundAmount(totalSales - totalRefunds);
  const deposit = await getVendorDeposit(vendorId, settlementDate);
  const electricity = await getVendorElectricityFee(vendorId, periodStart, periodEnd);
  const previousPayments = await getVendorPreviousPayments(vendorId, settlementDate);
  
  const amountDue = roundAmount(
    netSales - totalCommission - deposit - electricity - previousPayments
  );
  
  return {
    vendor_id: vendorId,
    vendor_name: vendor.name,
    booths: Array.from(boothMap.values()),
    total_sales: totalSales,
    total_refunds: totalRefunds,
    net_sales: netSales,
    commission_amount: totalCommission,
    deposit_amount: deposit,
    electricity_fee: electricity,
    previous_payments: previousPayments,
    amount_due: amountDue
  };
}

async function getAllVendorsForSettlement() {
  const { getDb } = require('./db');
  const db = await getDb();
  return db.prepare('SELECT * FROM vendors ORDER BY name').all();
}

async function checkFileAlreadyImported(dataType, fileHash) {
  const { getDb } = require('./db');
  const db = await getDb();
  const result = db.prepare(
    'SELECT * FROM import_logs WHERE data_type = ? AND file_hash = ? ORDER BY created_at DESC LIMIT 1'
  ).get(dataType, fileHash);
  
  return result ? result : null;
}

async function logImport(dataType, filePath, fileHash, recordsCount, processedCount, skippedCount) {
  const { getDb } = require('./db');
  const db = await getDb();
  db.prepare(`
    INSERT INTO import_logs (id, data_type, file_path, file_hash, records_count, processed_count, skipped_count)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(generateId(), dataType, filePath, fileHash, recordsCount, processedCount, skippedCount);
}

function validateSalesRecord(record, existingVendors, existingBooths) {
  const errors = [];
  const warnings = [];
  
  if (!record.vendor_id) {
    errors.push('缺少摊主ID');
  } else if (!existingVendors.has(record.vendor_id)) {
    errors.push(`摊主不存在: ${record.vendor_id}`);
  }
  
  if (!record.booth_id) {
    errors.push('缺少摊位ID');
  } else if (!existingBooths.has(record.booth_id)) {
    errors.push(`摊位不存在: ${record.booth_id}`);
  }
  
  if (!record.sale_date) {
    errors.push('缺少销售日期');
  }
  
  if (record.amount === null || record.amount === undefined) {
    errors.push('缺少销售金额');
  } else if (record.amount < 0) {
    warnings.push('销售金额为负数');
  }
  
  return { errors, warnings };
}

function validateRefundRecord(record, existingVendors, existingBooths) {
  const errors = [];
  const warnings = [];
  
  if (!record.vendor_id) {
    errors.push('缺少摊主ID');
  } else if (!existingVendors.has(record.vendor_id)) {
    errors.push(`摊主不存在: ${record.vendor_id}`);
  }
  
  if (!record.refund_date) {
    errors.push('缺少退款日期');
  }
  
  if (record.amount === null || record.amount === undefined) {
    errors.push('缺少退款金额');
  } else if (record.amount <= 0) {
    warnings.push('退款金额应为正数');
  }
  
  return { errors, warnings };
}

module.exports = {
  getCommissionRate,
  calculateCommission,
  getVendorBoothForDate,
  getVendorSalesByBooth,
  getVendorRefundsByBooth,
  getHistoricalRefunds,
  getPeriodRefunds,
  getVendorDeposit,
  getVendorElectricityFee,
  getVendorPreviousPayments,
  calculateVendorSettlement,
  getAllVendorsForSettlement,
  checkFileAlreadyImported,
  logImport,
  validateSalesRecord,
  validateRefundRecord
};
