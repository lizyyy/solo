const { loadConfig } = require('./db');
const { generateId, roundAmount } = require('./utils');

function logValidation(db, validationType, entityType, entityId, message, severity) {
  db.prepare(`
    INSERT INTO validation_logs (id, validation_type, entity_type, entity_id, message, severity)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(generateId(), validationType, entityType, entityId, message, severity);
}

async function validateVendors(db) {
  const vendors = db.prepare('SELECT * FROM vendors').all();
  const issues = [];
  
  for (const vendor of vendors) {
    if (!vendor.name || vendor.name.trim() === '') {
      issues.push({
        entityType: 'vendor',
        entityId: vendor.id,
        message: `摊主 ${vendor.id} 没有名称`,
        severity: 'error'
      });
    }
    
    const boothAssignment = db.prepare(`
      SELECT * FROM vendor_booth_assignments 
      WHERE vendor_id = ? AND end_date IS NULL
      LIMIT 1
    `).get(vendor.id);
    
    if (!boothAssignment) {
      issues.push({
        entityType: 'vendor',
        entityId: vendor.id,
        message: `摊主 "${vendor.name}" 没有分配摊位`,
        severity: 'warning'
      });
    }
    
    const sales = db.prepare(`
      SELECT COUNT(*) as count FROM sales_records WHERE vendor_id = ?
    `).get(vendor.id);
    
    if (sales && sales.count === 0) {
      issues.push({
        entityType: 'vendor',
        entityId: vendor.id,
        message: `摊主 "${vendor.name}" 没有销售记录`,
        severity: 'info'
      });
    }
  }
  
  return issues;
}

async function validateBooths(db) {
  const booths = db.prepare('SELECT * FROM booths').all();
  const issues = [];
  
  for (const booth of booths) {
    if (!booth.booth_number || booth.booth_number.trim() === '') {
      issues.push({
        entityType: 'booth',
        entityId: booth.id,
        message: `摊位 ${booth.id} 没有编号`,
        severity: 'error'
      });
    }
    
    const assignments = db.prepare(`
      SELECT * FROM vendor_booth_assignments WHERE booth_id = ?
    `).all(booth.id);
    
    const activeAssignments = assignments.filter(a => !a.end_date);
    if (activeAssignments.length > 1) {
      issues.push({
        entityType: 'booth',
        entityId: booth.id,
        message: `摊位 ${booth.booth_number} 被 ${activeAssignments.length} 个摊主同时占用`,
        severity: 'error'
      });
    }
  }
  
  return issues;
}

async function validateSalesRecords(db) {
  const sales = db.prepare(`
    SELECT sr.*, v.name as vendor_name, b.booth_number
    FROM sales_records sr
    LEFT JOIN vendors v ON sr.vendor_id = v.id
    LEFT JOIN booths b ON sr.booth_id = b.id
  `).all();
  
  const issues = [];
  
  for (const sale of sales) {
    if (!sale.vendor_name) {
      issues.push({
        entityType: 'sales',
        entityId: sale.id,
        message: `销售记录 ${sale.id} 引用不存在的摊主: ${sale.vendor_id}`,
        severity: 'error'
      });
    }
    
    if (!sale.booth_number) {
      issues.push({
        entityType: 'sales',
        entityId: sale.id,
        message: `销售记录 ${sale.id} 引用不存在的摊位: ${sale.booth_id}`,
        severity: 'error'
      });
    }
    
    if (sale.amount < 0) {
      issues.push({
        entityType: 'sales',
        entityId: sale.id,
        message: `摊主 "${sale.vendor_name}" 在 ${sale.sale_date} 的销售金额为负数: ${sale.amount}`,
        severity: 'warning'
      });
    }
    
    const boothAssignment = db.prepare(`
      SELECT 1 FROM vendor_booth_assignments 
      WHERE vendor_id = ? AND booth_id = ?
      AND start_date <= ?
      AND (end_date IS NULL OR end_date >= ?)
    `).get(sale.vendor_id, sale.booth_id, sale.sale_date, sale.sale_date);
    
    if (!boothAssignment) {
      issues.push({
        entityType: 'sales',
        entityId: sale.id,
        message: `销售记录显示摊主 "${sale.vendor_name}" 在 ${sale.sale_date} 不在摊位 ${sale.booth_number}`,
        severity: 'warning'
      });
    }
  }
  
  return issues;
}

async function validateRefunds(db) {
  const refunds = db.prepare(`
    SELECT r.*, v.name as vendor_name
    FROM refunds r
    LEFT JOIN vendors v ON r.vendor_id = v.id
  `).all();
  
  const issues = [];
  
  for (const refund of refunds) {
    if (!refund.vendor_name) {
      issues.push({
        entityType: 'refund',
        entityId: refund.id,
        message: `退款记录 ${refund.id} 引用不存在的摊主: ${refund.vendor_id}`,
        severity: 'error'
      });
    }
    
    if (refund.amount <= 0) {
      issues.push({
        entityType: 'refund',
        entityId: refund.id,
        message: `退款金额应为正数，当前为: ${refund.amount}`,
        severity: 'warning'
      });
    }
    
    if (refund.related_sale_id) {
      const relatedSale = db.prepare(
        'SELECT * FROM sales_records WHERE id = ?'
      ).get(refund.related_sale_id);
      
      if (!relatedSale) {
        issues.push({
          entityType: 'refund',
          entityId: refund.id,
          message: `退款关联的销售记录不存在: ${refund.related_sale_id}`,
          severity: 'warning'
        });
      }
    }
  }
  
  return issues;
}

async function validateCommissionRates(db) {
  const rates = db.prepare('SELECT * FROM commission_rates').all();
  const issues = [];
  
  for (const rate of rates) {
    if (rate.rate_type === 'flat' && (rate.flat_rate === null || rate.flat_rate === undefined)) {
      issues.push({
        entityType: 'commission_rate',
        entityId: rate.id,
        message: `固定抽成比例缺少 flat_rate 值`,
        severity: 'error'
      });
    }
    
    if (rate.rate_type === 'tiered' && !rate.tier_config) {
      issues.push({
        entityType: 'commission_rate',
        entityId: rate.id,
        message: `阶梯抽成缺少 tier_config 配置`,
        severity: 'error'
      });
    }
    
    if (rate.flat_rate !== null && rate.flat_rate !== undefined) {
      if (rate.flat_rate < 0 || rate.flat_rate > 1) {
        issues.push({
          entityType: 'commission_rate',
          entityId: rate.id,
          message: `抽成比例应在 0 到 1 之间，当前为: ${rate.flat_rate}`,
          severity: 'warning'
        });
      }
    }
    
    if (rate.rate_type === 'tiered' && rate.tier_config) {
      try {
        const tiers = typeof rate.tier_config === 'string' 
          ? JSON.parse(rate.tier_config) 
          : rate.tier_config;
        
        if (!Array.isArray(tiers)) {
          issues.push({
            entityType: 'commission_rate',
            entityId: rate.id,
            message: `阶梯抽成配置格式错误，应为数组`,
            severity: 'error'
          });
        } else {
          for (const tier of tiers) {
            if (tier.rate < 0 || tier.rate > 1) {
              issues.push({
                entityType: 'commission_rate',
                entityId: rate.id,
                message: `阶梯抽成比例应在 0 到 1 之间，当前为: ${tier.rate}`,
                severity: 'warning'
              });
            }
          }
        }
      } catch (e) {
        issues.push({
          entityType: 'commission_rate',
          entityId: rate.id,
          message: `阶梯抽成配置解析失败: ${e.message}`,
          severity: 'error'
        });
      }
    }
  }
  
  return issues;
}

async function validateDeposits(db) {
  const deposits = db.prepare(`
    SELECT d.*, v.name as vendor_name
    FROM deposits d
    LEFT JOIN vendors v ON d.vendor_id = v.id
  `).all();
  
  const issues = [];
  
  for (const deposit of deposits) {
    if (!deposit.vendor_name) {
      issues.push({
        entityType: 'deposit',
        entityId: deposit.id,
        message: `押金记录 ${deposit.id} 引用不存在的摊主: ${deposit.vendor_id}`,
        severity: 'error'
      });
    }
    
    if (deposit.amount <= 0) {
      issues.push({
        entityType: 'deposit',
        entityId: deposit.id,
        message: `押金金额应为正数，当前为: ${deposit.amount}`,
        severity: 'warning'
      });
    }
  }
  
  return issues;
}

async function validateSettlementReady(db) {
  const issues = [];
  
  const config = loadConfig();
  const defaultRate = config ? config.defaultCommissionRate : null;
  
  const vendors = db.prepare('SELECT * FROM vendors').all();
  
  for (const vendor of vendors) {
    const activeBooth = db.prepare(`
      SELECT * FROM vendor_booth_assignments 
      WHERE vendor_id = ? AND end_date IS NULL
      LIMIT 1
    `).get(vendor.id);
    
    if (!activeBooth) continue;
    
    const hasRate = db.prepare(`
      SELECT 1 FROM commission_rates
      WHERE (vendor_id = ? OR booth_id = ?)
    `).get(vendor.id, activeBooth.booth_id);
    
    if (!hasRate && !defaultRate) {
      issues.push({
        entityType: 'vendor',
        entityId: vendor.id,
        message: `摊主 "${vendor.name}" 没有配置抽成比例，也没有默认抽成比例`,
        severity: 'error'
      });
    }
  }
  
  return issues;
}

async function runAllValidations() {
  const { getDb } = require('./db');
  const db = await getDb();
  
  db.prepare('DELETE FROM validation_logs').run();
  
  const allIssues = [];
  
  allIssues.push(...await validateVendors(db));
  allIssues.push(...await validateBooths(db));
  allIssues.push(...await validateSalesRecords(db));
  allIssues.push(...await validateRefunds(db));
  allIssues.push(...await validateCommissionRates(db));
  allIssues.push(...await validateDeposits(db));
  allIssues.push(...await validateSettlementReady(db));
  
  for (const issue of allIssues) {
    logValidation(
      db,
      'full_validation',
      issue.entityType,
      issue.entityId,
      issue.message,
      issue.severity
    );
  }
  
  const errors = allIssues.filter(i => i.severity === 'error');
  const warnings = allIssues.filter(i => i.severity === 'warning');
  const infos = allIssues.filter(i => i.severity === 'info');
  
  return {
    total: allIssues.length,
    errors: errors.length,
    warnings: warnings.length,
    infos: infos.length,
    issues: allIssues,
    isValid: errors.length === 0
  };
}

async function getValidationSummary() {
  const { getDb } = require('./db');
  const db = await getDb();
  
  const errors = db.prepare(
    "SELECT * FROM validation_logs WHERE severity = 'error'"
  ).all();
  
  const warnings = db.prepare(
    "SELECT * FROM validation_logs WHERE severity = 'warning'"
  ).all();
  
  const infos = db.prepare(
    "SELECT * FROM validation_logs WHERE severity = 'info'"
  ).all();
  
  return {
    errors,
    warnings,
    infos,
    total: errors.length + warnings.length + infos.length,
    isValid: errors.length === 0
  };
}

module.exports = {
  runAllValidations,
  getValidationSummary,
  validateVendors,
  validateBooths,
  validateSalesRecords,
  validateRefunds,
  validateCommissionRates,
  validateDeposits,
  validateSettlementReady
};
