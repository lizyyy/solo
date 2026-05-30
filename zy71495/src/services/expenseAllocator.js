const { v4: uuidv4 } = require('uuid');
const moment = require('moment');
const { getDb } = require('../db/connection');
const config = require('../config');
const { runAllChecks } = require('./anomalyDetector');

const ALLOCATION_TYPES = {
  RENTAL_FEE: 'RENTAL_FEE',
  DAMAGE_FEE: 'DAMAGE_FEE',
  DEPOSIT_DEDUCT: 'DEPOSIT_DEDUCT'
};

const calculateUsageDuration = (startTime, endTime) => {
  const start = moment(startTime);
  const end = moment(endTime);
  const minutes = end.diff(start, 'minutes');
  return Math.ceil(minutes / 60 * 100) / 100;
};

const clearExistingAllocations = async (db, orderId) => {
  await db.prepare('DELETE FROM expense_allocations WHERE order_id = ?').run(orderId);
};

const calculateRentalItemAllocations = async (db, item, orderId) => {
  const allocations = [];
  
  const usageRecords = await db.prepare(`
    SELECT ur.*, m.name as member_name
    FROM usage_records ur
    JOIN members m ON ur.member_id = m.member_id
    WHERE ur.item_id = ?
    ORDER BY ur.start_time
  `).all(item.item_id);

  if (usageRecords.length === 0) {
    return allocations;
  }

  const totalUsageHours = usageRecords.reduce((sum, ur) => sum + ur.duration_hours, 0);
  
  if (totalUsageHours <= 0) {
    return allocations;
  }

  let calculatedSubtotal = 0;
  for (const usage of usageRecords) {
    const ratio = usage.duration_hours / totalUsageHours;
    const allocatedAmount = Number((item.subtotal * ratio).toFixed(2));
    calculatedSubtotal += allocatedAmount;

    allocations.push({
      allocation_id: uuidv4(),
      order_id: orderId,
      item_id: item.item_id,
      member_id: usage.member_id,
      usage_id: usage.usage_id,
      equipment_id: item.equipment_id,
      allocated_amount: allocatedAmount,
      allocation_ratio: Number(ratio.toFixed(4)),
      allocation_type: ALLOCATION_TYPES.RENTAL_FEE
    });
  }

  if (allocations.length > 0 && Math.abs(calculatedSubtotal - item.subtotal) > 0.01) {
    const diff = Number((item.subtotal - calculatedSubtotal).toFixed(2));
    allocations[allocations.length - 1].allocated_amount = 
      Number((allocations[allocations.length - 1].allocated_amount + diff).toFixed(2));
  }

  return allocations;
};

const calculateDamageAllocations = async (db, damage, orderId, members, damageAllocBasis = 'EQUAL') => {
  const allocations = [];
  
  if (damage.repair_cost <= 0 || !members || members.length === 0) {
    return allocations;
  }

  if (damageAllocBasis === 'EQUAL') {
    const perPerson = Number((damage.repair_cost / members.length).toFixed(2));
    let allocated = 0;

    for (let i = 0; i < members.length; i++) {
      const isLast = i === members.length - 1;
      const amount = isLast ? Number((damage.repair_cost - allocated).toFixed(2)) : perPerson;
      allocated += amount;

      allocations.push({
        allocation_id: uuidv4(),
        order_id: orderId,
        item_id: damage.item_id,
        member_id: members[i].member_id,
        usage_id: null,
        equipment_id: damage.equipment_id,
        allocated_amount: amount,
        allocation_ratio: Number((1 / members.length).toFixed(4)),
        allocation_type: ALLOCATION_TYPES.DAMAGE_FEE
      });
    }
  } else if (damageAllocBasis === 'USAGE_RATIO') {
    const usageRecords = await db.prepare(`
      SELECT ur.member_id, SUM(ur.duration_hours) as total_hours
      FROM usage_records ur
      JOIN rental_items ri ON ur.item_id = ri.item_id
      WHERE ri.order_id = ? AND ri.equipment_id = ?
      GROUP BY ur.member_id
    `).all(orderId, damage.equipment_id);

    const totalHours = usageRecords.reduce((sum, ur) => sum + ur.total_hours, 0);
    
    if (totalHours > 0) {
      let allocated = 0;
      for (let i = 0; i < usageRecords.length; i++) {
        const ur = usageRecords[i];
        const ratio = ur.total_hours / totalHours;
        const isLast = i === usageRecords.length - 1;
        const amount = isLast 
          ? Number((damage.repair_cost - allocated).toFixed(2))
          : Number((damage.repair_cost * ratio).toFixed(2));
        allocated += amount;

        allocations.push({
          allocation_id: uuidv4(),
          order_id: orderId,
          item_id: damage.item_id,
          member_id: ur.member_id,
          usage_id: null,
          equipment_id: damage.equipment_id,
          allocated_amount: amount,
          allocation_ratio: Number(ratio.toFixed(4)),
          allocation_type: ALLOCATION_TYPES.DAMAGE_FEE
        });
      }
    }
  }

  return allocations;
};

const calculateOrderAmounts = async (db, orderId) => {
  const result = await db.prepare(`
    SELECT 
      COALESCE(SUM(ri.subtotal), 0) as total_amount,
      COALESCE(SUM(d.collected_amount), 0) as total_deposit
    FROM rental_orders ro
    LEFT JOIN rental_items ri ON ro.order_id = ri.order_id
    LEFT JOIN deposits d ON ri.item_id = d.item_id
    WHERE ro.order_id = ?
    GROUP BY ro.order_id
  `).get(orderId);

  return result || { total_amount: 0, total_deposit: 0 };
};

const runAllocation = async (orderId, options = {}) => {
  const db = await getDb();
  const { damageAllocBasis = 'EQUAL', autoDetectAnomalies = true } = options;

  const order = await db.prepare('SELECT * FROM rental_orders WHERE order_id = ?').get(orderId);
  if (!order) {
    throw new Error(`Rental order not found: ${orderId}`);
  }

  if (order.status === 'SETTLED' || order.status === 'CLOSED') {
    throw new Error(`Cannot re-allocate: order ${orderId} is already ${order.status}`);
  }

  let anomalyResult = null;
  if (autoDetectAnomalies) {
    anomalyResult = await runAllChecks();
  }

  await db.transaction(async () => {
    await clearExistingAllocations(db, orderId);

    const items = await db.prepare(`
      SELECT * FROM rental_items WHERE order_id = ?
    `).all(orderId);

    const allAllocations = [];

    for (const item of items) {
      const usageHours = (await db.prepare(`
        SELECT SUM(duration_hours) as total FROM usage_records WHERE item_id = ?
      `).get(item.item_id)).total || 0;

      let subtotal = item.subtotal;
      if (usageHours > 0 && item.hourly_rate > 0) {
        subtotal = Number((usageHours * item.hourly_rate).toFixed(2));
        await db.prepare('UPDATE rental_items SET subtotal = ? WHERE item_id = ?').run(subtotal, item.item_id);
      }

      const rentalAllocations = await calculateRentalItemAllocations(db, item, orderId);
      allAllocations.push(...rentalAllocations);
    }

    const damages = await db.prepare(`
      SELECT * FROM damage_records WHERE order_id = ? AND repair_cost > 0
    `).all(orderId);

    const orderMembers = await db.prepare(`
      SELECT DISTINCT m.* 
      FROM members m
      JOIN usage_records ur ON m.member_id = ur.member_id
      JOIN rental_items ri ON ur.item_id = ri.item_id
      WHERE ri.order_id = ?
    `).all(orderId);

    for (const damage of damages) {
      const damageAllocations = await calculateDamageAllocations(
        db, damage, orderId, orderMembers, damageAllocBasis
      );
      allAllocations.push(...damageAllocations);

      if (damageAllocations.length > 0) {
        const totalAllocated = damageAllocations.reduce((sum, a) => sum + a.allocated_amount, 0);
        await db.prepare(`
          UPDATE damage_records 
          SET is_allocated = 1, allocated_amount = ?
          WHERE damage_id = ?
        `).run(totalAllocated, damage.damage_id);
      }
    }

    const insertStmt = await db.prepare(`
      INSERT INTO expense_allocations 
      (allocation_id, order_id, item_id, member_id, usage_id, equipment_id, 
       allocated_amount, allocation_ratio, allocation_type)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const alloc of allAllocations) {
      await insertStmt.run(
        alloc.allocation_id,
        alloc.order_id,
        alloc.item_id,
        alloc.member_id,
        alloc.usage_id,
        alloc.equipment_id,
        alloc.allocated_amount,
        alloc.allocation_ratio,
        alloc.allocation_type
      );
    }

    const amounts = await calculateOrderAmounts(db, orderId);
    const totalAllocated = (await db.prepare(`
      SELECT COALESCE(SUM(allocated_amount), 0) as total 
      FROM expense_allocations WHERE order_id = ?
    `).get(orderId)).total;

    await db.prepare(`
      UPDATE rental_orders 
      SET total_amount = ?, total_deposit = ?, total_allocated = ?, updated_at = datetime('now')
      WHERE order_id = ?
    `).run(amounts.total_amount, amounts.total_deposit, totalAllocated, orderId);
  });

  const summary = await getAllocationSummary(orderId);

  return {
    success: true,
    orderId,
    anomalyDetected: anomalyResult ? anomalyResult.totalAnomalies > 0 : false,
    anomalyCount: anomalyResult ? anomalyResult.totalAnomalies : 0,
    allocationSummary: summary
  };
};

const getAllocationSummary = async (orderId) => {
  const db = await getDb();

  const byMember = await db.prepare(`
    SELECT 
      m.member_id,
      m.name as member_name,
      ea.allocation_type,
      SUM(ea.allocated_amount) as total_amount
    FROM expense_allocations ea
    JOIN members m ON ea.member_id = m.member_id
    WHERE ea.order_id = ?
    GROUP BY m.member_id, m.name, ea.allocation_type
    ORDER BY m.name, ea.allocation_type
  `).all(orderId);

  const byEquipment = await db.prepare(`
    SELECT 
      e.equipment_id,
      e.name as equipment_name,
      ea.allocation_type,
      SUM(ea.allocated_amount) as total_amount
    FROM expense_allocations ea
    JOIN equipment e ON ea.equipment_id = e.equipment_id
    WHERE ea.order_id = ?
    GROUP BY e.equipment_id, e.name, ea.allocation_type
    ORDER BY e.name, ea.allocation_type
  `).all(orderId);

  const total = await db.prepare(`
    SELECT 
      COALESCE(SUM(CASE WHEN allocation_type = 'RENTAL_FEE' THEN allocated_amount ELSE 0 END), 0) as rental_total,
      COALESCE(SUM(CASE WHEN allocation_type = 'DAMAGE_FEE' THEN allocated_amount ELSE 0 END), 0) as damage_total,
      COALESCE(SUM(allocated_amount), 0) as grand_total
    FROM expense_allocations WHERE order_id = ?
  `).get(orderId);

  return {
    byMember,
    byEquipment,
    totals: total
  };
};

const getMemberAllocations = async (memberId, orderId = null) => {
  const db = await getDb();
  const conditions = ['ea.member_id = ?'];
  const params = [memberId];

  if (orderId) {
    conditions.push('ea.order_id = ?');
    params.push(orderId);
  }

  return await db.prepare(`
    SELECT 
      ea.*,
      e.name as equipment_name,
      m.name as member_name,
      ro.order_date,
      ro.status as order_status
    FROM expense_allocations ea
    JOIN equipment e ON ea.equipment_id = e.equipment_id
    JOIN members m ON ea.member_id = m.member_id
    JOIN rental_orders ro ON ea.order_id = ro.order_id
    WHERE ${conditions.join(' AND ')}
    ORDER BY ro.order_date DESC, ea.created_at DESC
  `).all(...params);
};

const getAllocationsWithTrace = async (allocationId) => {
  const db = await getDb();

  const allocation = await db.prepare(`
    SELECT 
      ea.*,
      e.name as equipment_name,
      m.name as member_name,
      ro.order_id,
      ro.order_date,
      ri.item_id,
      ur.start_time,
      ur.end_time,
      ur.duration_hours
    FROM expense_allocations ea
    JOIN equipment e ON ea.equipment_id = e.equipment_id
    JOIN members m ON ea.member_id = m.member_id
    JOIN rental_orders ro ON ea.order_id = ro.order_id
    JOIN rental_items ri ON ea.item_id = ri.item_id
    LEFT JOIN usage_records ur ON ea.usage_id = ur.usage_id
    WHERE ea.allocation_id = ?
  `).get(allocationId);

  if (!allocation) return null;

  const batch = await db.prepare(`
    SELECT br.* FROM batch_records br
    JOIN rental_orders ro ON br.batch_id = ro.batch_id
    WHERE ro.order_id = ?
  `).get(allocation.order_id);

  return {
    allocation,
    trace: {
      batch,
      order: {
        order_id: allocation.order_id,
        order_date: allocation.order_date
      },
      item: {
        item_id: allocation.item_id
      },
      usage: allocation.usage_id ? {
        usage_id: allocation.usage_id,
        start_time: allocation.start_time,
        end_time: allocation.end_time,
        duration_hours: allocation.duration_hours
      } : null
    }
  };
};

module.exports = {
  ALLOCATION_TYPES,
  calculateUsageDuration,
  runAllocation,
  getAllocationSummary,
  getMemberAllocations,
  getAllocationsWithTrace
};
