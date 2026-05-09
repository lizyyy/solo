const db = require('../db/init');
const { v4: uuidv4 } = require('uuid');
const dayjs = require('dayjs');

function getTenantAreasForPeriod(period) {
  const periodStart = dayjs(period + '-01').format('YYYY-MM-DD');
  const periodEnd = dayjs(period + '-01').endOf('month').format('YYYY-MM-DD');
  
  return db.prepare(`
    SELECT 
      tav.tenant_id,
      t.code as tenant_code,
      t.name as tenant_name,
      tav.area
    FROM tenant_area_versions tav
    JOIN tenants t ON tav.tenant_id = t.id
    WHERE tav.effective_from <= ?
      AND (tav.effective_to IS NULL OR tav.effective_to >= ?)
  `).all(periodEnd, periodStart);
}

function getActiveRule(period) {
  const periodStart = dayjs(period + '-01').format('YYYY-MM-DD');
  
  const rule = db.prepare(`
    SELECT * FROM allocation_rules
    WHERE effective_from <= ?
      AND (effective_to IS NULL OR effective_to >= ?)
      AND is_active = 1
    ORDER BY version DESC
    LIMIT 1
  `).get(periodStart, periodStart);
  
  if (!rule) {
    throw new Error(`未找到 ${period} 有效的分摊规则`);
  }
  
  return {
    ...rule,
    rule_config: JSON.parse(rule.rule_config)
  };
}

function getMeterReading(meterId, period) {
  const reading = db.prepare(`
    SELECT * FROM meter_readings
    WHERE meter_id = ? AND period = ?
  `).get(meterId, period);
  
  if (!reading) {
    throw new Error(`未找到电表 ${meterId} 在 ${period} 的读数`);
  }
  
  let consumption = reading.consumption;
  if (consumption == null && reading.last_reading != null) {
    consumption = reading.reading - reading.last_reading;
  }
  
  if (consumption == null || consumption <= 0) {
    throw new Error(`电表 ${meterId} 在 ${period} 的用电量无效: ${consumption}`);
  }
  
  return { ...reading, consumption };
}

function calculateAllocation(tenantAreas, totalConsumption, ruleConfig) {
  const totalArea = tenantAreas.reduce((sum, t) => sum + t.area, 0);
  
  if (totalArea <= 0) {
    throw new Error('租户总面积为0，无法进行分摊');
  }
  
  const pricePerUnit = ruleConfig.pricePerUnit || 1.0;
  const lossRatio = ruleConfig.lossRatio || 0;
  
  const consumptionWithLoss = totalConsumption * (1 + lossRatio);
  const totalAmount = consumptionWithLoss * pricePerUnit;
  
  const items = tenantAreas.map(tenant => {
    const ratio = tenant.area / totalArea;
    const tenantConsumption = consumptionWithLoss * ratio;
    const tenantAmount = tenantConsumption * pricePerUnit;
    
    return {
      id: uuidv4(),
      tenant_id: tenant.tenant_id,
      tenant_code: tenant.tenant_code,
      tenant_name: tenant.tenant_name,
      tenant_area: tenant.area,
      allocation_ratio: ratio,
      consumption: tenantConsumption,
      amount: tenantAmount,
      price_per_unit: pricePerUnit
    };
  });
  
  return {
    totalConsumption: consumptionWithLoss,
    totalAmount,
    items
  };
}

function generateBill(period, meterId, requestId) {
  const existingBill = db.prepare(`
    SELECT * FROM bills WHERE period = ? AND meter_id = ?
  `).get(period, meterId);
  
  if (existingBill) {
    throw new Error(`账单已存在: ${period} - ${meterId}`);
  }
  
  const rule = getActiveRule(period);
  const reading = getMeterReading(meterId, period);
  const tenantAreas = getTenantAreasForPeriod(period);
  
  if (tenantAreas.length === 0) {
    throw new Error(`未找到 ${period} 的租户信息`);
  }
  
  const result = calculateAllocation(tenantAreas, reading.consumption, rule.rule_config);
  
  const tx = db.transaction(() => {
    const billId = uuidv4();
    
    db.prepare(`
      INSERT INTO bills (
        id, period, meter_id, rule_version, status,
        total_consumption, total_amount, generated_at, request_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), ?)
    `).run(
      billId, period, meterId, rule.version,
      'generated', result.totalConsumption, result.totalAmount, requestId
    );
    
    const insertItem = db.prepare(`
      INSERT INTO bill_items (
        id, bill_id, tenant_id, tenant_area,
        allocation_ratio, consumption, amount, price_per_unit
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    result.items.forEach(item => {
      insertItem.run(
        item.id, billId, item.tenant_id, item.tenant_area,
        item.allocation_ratio, item.consumption, item.amount, item.price_per_unit
      );
    });
    
    return {
      billId,
      ...result,
      ruleVersion: rule.version,
      readingId: reading.id
    };
  });
  
  return tx();
}

function recalculateBill(billId, requestId) {
  const bill = db.prepare(`
    SELECT * FROM bills WHERE id = ?
  `).get(billId);
  
  if (!bill) {
    throw new Error('账单不存在');
  }
  
  const rule = getActiveRule(bill.period);
  const reading = getMeterReading(bill.meter_id, bill.period);
  const tenantAreas = getTenantAreasForPeriod(bill.period);
  
  if (tenantAreas.length === 0) {
    throw new Error(`未找到 ${bill.period} 的租户信息`);
  }
  
  const result = calculateAllocation(tenantAreas, reading.consumption, rule.rule_config);
  
  const tx = db.transaction(() => {
    db.prepare(`DELETE FROM bill_items WHERE bill_id = ?`).run(billId);
    
    db.prepare(`
      UPDATE bills SET
        rule_version = ?,
        total_consumption = ?,
        total_amount = ?,
        status = 'generated',
        re_calculated_at = datetime('now'),
        request_id = ?,
        error_message = NULL,
        updated_at = datetime('now')
      WHERE id = ?
    `).run(rule.version, result.totalConsumption, result.totalAmount, requestId, billId);
    
    const insertItem = db.prepare(`
      INSERT INTO bill_items (
        id, bill_id, tenant_id, tenant_area,
        allocation_ratio, consumption, amount, price_per_unit
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    result.items.forEach(item => {
      insertItem.run(
        item.id, billId, item.tenant_id, item.tenant_area,
        item.allocation_ratio, item.consumption, item.amount, item.price_per_unit
      );
    });
    
    return {
      billId,
      ...result,
      ruleVersion: rule.version
    };
  });
  
  return tx();
}

module.exports = {
  getTenantAreasForPeriod,
  getActiveRule,
  getMeterReading,
  calculateAllocation,
  generateBill,
  recalculateBill
};
