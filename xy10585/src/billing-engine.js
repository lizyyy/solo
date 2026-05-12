const { store, db } = require('./database');
const { v4: uuidv4 } = require('uuid');

function daysBetween(date1, date2) {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  const diffTime = Math.abs(d2 - d1);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

function getZoneRate(zoneId, customerId, billingDate) {
  const rates = store.zone_rates.filter(r => 
    r.zone_id === zoneId && 
    r.effective_date <= billingDate &&
    (!r.end_date || r.end_date >= billingDate) &&
    (!r.customer_id || r.customer_id === customerId)
  );
  rates.sort((a, b) => (b.customer_id ? 1 : 0) - (a.customer_id ? 1 : 0));
  return rates[0];
}

function getAgeLadder(ageDays) {
  const ladders = store.age_ladders.filter(l => 
    l.min_days <= ageDays && (!l.max_days || l.max_days >= ageDays)
  );
  ladders.sort((a, b) => b.min_days - a.min_days);
  return ladders[0];
}

function getOperationLadder(totalOperations) {
  const ladders = store.operation_ladders.filter(l => 
    l.min_operations <= totalOperations && (!l.max_operations || l.max_operations >= totalOperations)
  );
  ladders.sort((a, b) => b.min_operations - a.min_operations);
  return ladders[0];
}

function getZoneById(zoneId) {
  return store.temperature_zones.find(z => z.id === zoneId);
}

function calculateStorageFees(customerId, periodStart, periodEnd) {
  const details = [];
  const lineItems = [];
  let totalStorageFee = 0;

  const inventories = store.inventory_snapshots.filter(inv => 
    inv.customer_id === customerId &&
    inv.received_date <= periodEnd &&
    inv.snapshot_date >= periodStart
  );

  for (const inv of inventories) {
    const zone = getZoneById(inv.zone_id);
    const effectiveStart = inv.received_date > periodStart ? inv.received_date : periodStart;
    const effectiveEnd = inv.snapshot_date < periodEnd ? inv.snapshot_date : periodEnd;
    
    const currentDate = new Date(effectiveStart);
    const endDate = new Date(effectiveEnd);

    while (currentDate <= endDate) {
      const currentDateStr = currentDate.toISOString().split('T')[0];
      const totalAgeDays = daysBetween(inv.received_date, currentDateStr);
      const ladder = getAgeLadder(totalAgeDays);
      const zoneRate = getZoneRate(inv.zone_id, customerId, currentDateStr);

      if (!zoneRate) {
        throw new Error(`未找到 ${zone?.name || inv.zone_id} 在 ${currentDateStr} 的费率配置`);
      }

      const baseRate = zoneRate.storage_rate_per_cbm_per_day;
      const multiplier = ladder ? ladder.multiplier : 1;
      const dailyFee = inv.total_volume_cbm * baseRate * multiplier;
      totalStorageFee += dailyFee;

      const ageDetail = {
        id: uuidv4(),
        bill_id: null,
        product_sku: inv.product_sku,
        received_date: inv.received_date,
        zone_id: inv.zone_id,
        zone_name: zone?.name,
        days_in_period: 1,
        age_days: totalAgeDays,
        age_ladder_id: ladder ? ladder.id : null,
        ladder_name: ladder ? ladder.name : '默认费率',
        volume_cbm: inv.total_volume_cbm,
        base_rate: baseRate,
        ladder_multiplier: multiplier,
        daily_fee: dailyFee,
        total_fee: dailyFee,
        billing_date: currentDateStr,
        created_at: new Date().toISOString().replace('T', ' ').substring(0, 19)
      };
      details.push(ageDetail);

      currentDate.setDate(currentDate.getDate() + 1);
    }
  }

  const aggregatedByZoneAndLadder = {};
  for (const detail of details) {
    const key = `${detail.zone_id}-${detail.ladder_name || '默认'}`;
    if (!aggregatedByZoneAndLadder[key]) {
      aggregatedByZoneAndLadder[key] = {
        zone_id: detail.zone_id,
        zone_name: detail.zone_name,
        ladder_name: detail.ladder_name,
        total_days: 0,
        total_volume_days: 0,
        total_fee: 0,
        base_rate: detail.base_rate,
        ladder_multiplier: detail.ladder_multiplier
      };
    }
    aggregatedByZoneAndLadder[key].total_days += detail.days_in_period;
    aggregatedByZoneAndLadder[key].total_volume_days += detail.volume_cbm;
    aggregatedByZoneAndLadder[key].total_fee += detail.total_fee;
  }

  for (const key in aggregatedByZoneAndLadder) {
    const agg = aggregatedByZoneAndLadder[key];
    lineItems.push({
      id: uuidv4(),
      bill_id: null,
      line_type: 'STORAGE',
      zone_id: agg.zone_id,
      product_sku: null,
      description: `仓储费 - ${agg.zone_name} - ${agg.ladder_name}`,
      quantity: agg.total_volume_days,
      unit_price: agg.base_rate * agg.ladder_multiplier,
      amount: agg.total_fee,
      ladder_name: agg.ladder_name,
      age_days: null,
      created_at: new Date().toISOString().replace('T', ' ').substring(0, 19)
    });
  }

  return {
    totalStorageFee,
    details,
    lineItems
  };
}

function calculateOperationFees(customerId, periodStart, periodEnd) {
  const lineItems = [];
  let totalInFee = 0;
  let totalOutFee = 0;

  const operations = store.operations.filter(op => 
    op.customer_id === customerId &&
    op.operation_date >= periodStart &&
    op.operation_date <= periodEnd &&
    op.status === 'PROCESSED'
  ).map(op => {
    const zone = getZoneById(op.zone_id);
    return { ...op, zone_name: zone?.name, zone_code: zone?.code };
  });

  const inOperations = operations.filter(op => op.operation_type === 'IN');
  const outOperations = operations.filter(op => op.operation_type === 'OUT');

  const totalInOperations = inOperations.length;
  const totalOutOperations = outOperations.length;

  const inLadder = getOperationLadder(totalInOperations);
  const outLadder = getOperationLadder(totalOutOperations);

  const inDiscount = inLadder ? inLadder.discount_rate : 1;
  const outDiscount = outLadder ? outLadder.discount_rate : 1;

  const inByZone = {};
  for (const op of inOperations) {
    const key = `${op.zone_id}-${op.product_sku}`;
    if (!inByZone[key]) {
      inByZone[key] = {
        zone_id: op.zone_id,
        zone_name: op.zone_name,
        product_sku: op.product_sku,
        count: 0,
        total_volume: 0
      };
    }
    inByZone[key].count++;
    inByZone[key].total_volume += op.volume_cbm;
  }

  const outByZone = {};
  for (const op of outOperations) {
    const key = `${op.zone_id}-${op.product_sku}`;
    if (!outByZone[key]) {
      outByZone[key] = {
        zone_id: op.zone_id,
        zone_name: op.zone_name,
        product_sku: op.product_sku,
        count: 0,
        total_volume: 0
      };
    }
    outByZone[key].count++;
    outByZone[key].total_volume += op.volume_cbm;
  }

  const midDate = new Date(new Date(periodStart).getTime() + (new Date(periodEnd).getTime() - new Date(periodStart).getTime()) / 2).toISOString().split('T')[0];

  for (const key in inByZone) {
    const agg = inByZone[key];
    const zoneRate = getZoneRate(agg.zone_id, customerId, midDate);
    if (zoneRate) {
      const unitPrice = zoneRate.in_operation_fee * inDiscount;
      const amount = agg.count * unitPrice;
      totalInFee += amount;

      lineItems.push({
        id: uuidv4(),
        bill_id: null,
        line_type: 'IN_OPERATION',
        zone_id: agg.zone_id,
        product_sku: agg.product_sku,
        description: `入库操作费 - ${agg.zone_name}${inLadder ? ` (${inLadder.name}${Math.round((1 - inDiscount) * 100)}%折扣)` : ''}`,
        quantity: agg.count,
        unit_price: unitPrice,
        amount: amount,
        ladder_name: inLadder ? inLadder.name : null,
        age_days: null,
        created_at: new Date().toISOString().replace('T', ' ').substring(0, 19)
      });
    }
  }

  for (const key in outByZone) {
    const agg = outByZone[key];
    const zoneRate = getZoneRate(agg.zone_id, customerId, midDate);
    if (zoneRate) {
      const unitPrice = zoneRate.out_operation_fee * outDiscount;
      const amount = agg.count * unitPrice;
      totalOutFee += amount;

      lineItems.push({
        id: uuidv4(),
        bill_id: null,
        line_type: 'OUT_OPERATION',
        zone_id: agg.zone_id,
        product_sku: agg.product_sku,
        description: `出库操作费 - ${agg.zone_name}${outLadder ? ` (${outLadder.name}${Math.round((1 - outDiscount) * 100)}%折扣)` : ''}`,
        quantity: agg.count,
        unit_price: unitPrice,
        amount: amount,
        ladder_name: outLadder ? outLadder.name : null,
        age_days: null,
        created_at: new Date().toISOString().replace('T', ' ').substring(0, 19)
      });
    }
  }

  return {
    totalInFee,
    totalOutFee,
    totalOperationFee: totalInFee + totalOutFee,
    lineItems
  };
}

function generateBill(customerId, periodStart, periodEnd, operator = 'system') {
  const existingBill = store.bills.find(b => 
    b.customer_id === customerId && 
    b.period_start === periodStart && 
    b.period_end === periodEnd
  );

  if (existingBill) {
    if (existingBill.status === 'CONFIRMED') {
      throw new Error('账单已确认，不可重新生成');
    }
    store.bill_line_items = store.bill_line_items.filter(item => item.bill_id !== existingBill.id);
    store.bill_age_details = store.bill_age_details.filter(d => d.bill_id !== existingBill.id);
  }

  const customer = store.customers.find(c => c.id === customerId);
  if (!customer) {
    throw new Error('客户不存在');
  }

  const storageResult = calculateStorageFees(customerId, periodStart, periodEnd);
  const operationResult = calculateOperationFees(customerId, periodStart, periodEnd);

  const totalAmount = storageResult.totalStorageFee + operationResult.totalOperationFee;

  const billId = existingBill ? existingBill.id : uuidv4();
  const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

  db.transaction(() => {
    if (existingBill) {
      existingBill.storage_fee = storageResult.totalStorageFee;
      existingBill.in_operation_fee = operationResult.totalInFee;
      existingBill.out_operation_fee = operationResult.totalOutFee;
      existingBill.total_amount = totalAmount;
      existingBill.updated_at = now;
    } else {
      const newBill = {
        id: billId,
        customer_id: customerId,
        period_start: periodStart,
        period_end: periodEnd,
        status: 'DRAFT',
        total_amount: totalAmount,
        storage_fee: storageResult.totalStorageFee,
        in_operation_fee: operationResult.totalInFee,
        out_operation_fee: operationResult.totalOutFee,
        adjustment_amount: 0,
        confirmed_by: null,
        confirmed_at: null,
        created_at: now,
        updated_at: now
      };
      store.bills.push(newBill);

      store.bill_status_history.push({
        id: uuidv4(),
        bill_id: billId,
        from_status: null,
        to_status: 'DRAFT',
        changed_by: operator,
        change_reason: '创建账单',
        created_at: now
      });
    }

    for (const item of storageResult.lineItems) {
      item.bill_id = billId;
      store.bill_line_items.push(item);
    }

    for (const item of operationResult.lineItems) {
      item.bill_id = billId;
      store.bill_line_items.push(item);
    }

    for (const detail of storageResult.details) {
      detail.bill_id = billId;
      store.bill_age_details.push(detail);
    }
  });

  return getBillWithDetails(billId);
}

function getBillWithDetails(billId) {
  const bill = store.bills.find(b => b.id === billId);
  if (!bill) return null;

  const customer = store.customers.find(c => c.id === bill.customer_id);
  const lineItems = store.bill_line_items.filter(item => item.bill_id === billId);
  const ageDetails = store.bill_age_details.filter(d => d.bill_id === billId).map(d => {
    const zone = getZoneById(d.zone_id);
    return { ...d, zone_name: zone?.name };
  });
  const statusHistory = [...store.bill_status_history.filter(h => h.bill_id === billId)]
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  const adjustments = [...store.adjustments.filter(a => a.bill_id === billId)]
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

  return {
    ...bill,
    customer,
    line_items: lineItems,
    age_details: ageDetails,
    status_history: statusHistory,
    adjustments: adjustments
  };
}

function updateBillStatus(billId, newStatus, operator, reason) {
  const bill = store.bills.find(b => b.id === billId);
  if (!bill) throw new Error('账单不存在');

  if (bill.status === 'CONFIRMED' && newStatus !== 'CONFIRMED') {
    throw new Error('已确认账单不可修改状态');
  }

  const validTransitions = {
    'DRAFT': ['PROCESSING', 'CANCELLED'],
    'PROCESSING': ['PENDING_CONFIRM', 'ERROR'],
    'PENDING_CONFIRM': ['CONFIRMED', 'DRAFT'],
    'CONFIRMED': [],
    'CANCELLED': [],
    'ERROR': ['DRAFT']
  };

  if (!validTransitions[bill.status]?.includes(newStatus)) {
    throw new Error(`无效的状态转换: ${bill.status} -> ${newStatus}`);
  }

  const oldStatus = bill.status;
  const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

  db.transaction(() => {
    bill.status = newStatus;
    bill.updated_at = now;

    if (newStatus === 'CONFIRMED') {
      bill.confirmed_by = operator;
      bill.confirmed_at = now;
    }

    store.bill_status_history.push({
      id: uuidv4(),
      bill_id: billId,
      from_status: oldStatus,
      to_status: newStatus,
      changed_by: operator,
      change_reason: reason || '状态推进',
      created_at: now
    });
  });

  return getBillWithDetails(billId);
}

function createAdjustment(billId, adjustedBy, adjustmentType, amount, reason) {
  const bill = store.bills.find(b => b.id === billId);
  if (!bill) throw new Error('账单不存在');
  if (bill.status === 'CONFIRMED') throw new Error('已确认账单不可调账，请先冲销');

  const beforeAmount = bill.total_amount + (bill.adjustment_amount || 0);
  const afterAmount = beforeAmount + amount;
  const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

  db.transaction(() => {
    bill.adjustment_amount = (bill.adjustment_amount || 0) + amount;
    bill.total_amount = afterAmount;
    bill.updated_at = now;

    store.adjustments.push({
      id: uuidv4(),
      bill_id: billId,
      adjusted_by: adjustedBy,
      adjustment_type: adjustmentType,
      amount: amount,
      reason: reason,
      before_amount: beforeAmount,
      after_amount: afterAmount,
      created_at: now
    });

    store.bill_line_items.push({
      id: uuidv4(),
      bill_id: billId,
      line_type: 'ADJUSTMENT',
      zone_id: 'N/A',
      product_sku: null,
      description: `调账 - ${adjustmentType}: ${reason}`,
      quantity: 1,
      unit_price: amount,
      amount: amount,
      ladder_name: null,
      age_days: null,
      created_at: now
    });
  });

  return getBillWithDetails(billId);
}

function checkIdempotency(idempotentKey, operationType) {
  return store.idempotent_records.find(r => 
    r.idempotent_key === idempotentKey && 
    r.operation_type === operationType
  );
}

function recordIdempotency(idempotentKey, operationType, resourceId, status, result) {
  const existing = store.idempotent_records.findIndex(r => 
    r.idempotent_key === idempotentKey && 
    r.operation_type === operationType
  );

  const record = {
    id: uuidv4(),
    idempotent_key: idempotentKey,
    operation_type: operationType,
    resource_id: resourceId,
    status: status,
    result: JSON.stringify(result),
    created_at: new Date().toISOString().replace('T', ' ').substring(0, 19)
  };

  if (existing >= 0) {
    store.idempotent_records[existing] = record;
  } else {
    store.idempotent_records.push(record);
  }
}

module.exports = {
  calculateStorageFees,
  calculateOperationFees,
  generateBill,
  getBillWithDetails,
  updateBillStatus,
  createAdjustment,
  checkIdempotency,
  recordIdempotency,
  getZoneRate,
  getAgeLadder,
  getOperationLadder,
  daysBetween
};
