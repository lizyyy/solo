const { v4: uuidv4 } = require('uuid');
const moment = require('moment');
const { getDb } = require('../db/connection');

const ANOMALY_TYPES = {
  DEPOSIT_MISSING_REFUND: 'DEPOSIT_MISSING_REFUND',
  USAGE_TIME_OVERLAP: 'USAGE_TIME_OVERLAP',
  DAMAGE_UNALLOCATED: 'DAMAGE_UNALLOCATED'
};

const SEVERITY = {
  HIGH: 'HIGH',
  MEDIUM: 'MEDIUM',
  WARNING: 'WARNING'
};

const detectDepositMissingRefund = async () => {
  const db = await getDb();
  const anomalies = [];

  const problematicDeposits = await db.prepare(`
    SELECT 
      d.deposit_id,
      d.order_id,
      d.item_id,
      d.equipment_id,
      d.collected_amount,
      d.refunded_amount,
      d.deducted_amount,
      d.status,
      ro.status as order_status,
      e.name as equipment_name
    FROM deposits d
    JOIN rental_orders ro ON d.order_id = ro.order_id
    JOIN equipment e ON d.equipment_id = e.equipment_id
    WHERE ro.status IN ('SETTLED', 'CLOSED')
      AND d.status IN ('COLLECTED', 'PARTIAL_REFUNDED')
      AND (d.collected_amount - d.refunded_amount - d.deducted_amount) > 0
  `).all();

  for (const deposit of problematicDeposits) {
    const remaining = deposit.collected_amount - deposit.refunded_amount - deposit.deducted_amount;
    const existing = await db.prepare(`
      SELECT 1 FROM anomalies 
      WHERE anomaly_type = ? AND entity_id = ? AND is_resolved = 0
    `).get(ANOMALY_TYPES.DEPOSIT_MISSING_REFUND, deposit.deposit_id);

    if (!existing) {
      const anomalyId = uuidv4();
      await db.prepare(`
        INSERT INTO anomalies 
        (anomaly_id, anomaly_type, severity, entity_type, entity_id, 
         description, related_ids)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        anomalyId,
        ANOMALY_TYPES.DEPOSIT_MISSING_REFUND,
        SEVERITY.HIGH,
        'DEPOSIT',
        deposit.deposit_id,
        `租赁单 [${deposit.order_id}] 已${deposit.order_status === 'CLOSED' ? '关闭' : '结算'}，但设备 [${deposit.equipment_name}] 的押金 ¥${remaining.toFixed(2)} 未退还`,
        JSON.stringify({ order_id: deposit.order_id, item_id: deposit.item_id, equipment_id: deposit.equipment_id })
      );
      anomalies.push({ anomalyId, deposit, remaining });
    }
  }

  return anomalies;
};

const detectUsageTimeOverlap = async () => {
  const db = await getDb();
  const anomalies = [];

  const usageRecords = await db.prepare(`
    SELECT 
      ur.usage_id,
      ur.item_id,
      ur.member_id,
      ur.start_time,
      ur.end_time,
      ur.duration_hours,
      ri.equipment_id,
      e.name as equipment_name,
      m.name as member_name,
      ri.order_id
    FROM usage_records ur
    JOIN rental_items ri ON ur.item_id = ri.item_id
    JOIN equipment e ON ri.equipment_id = e.equipment_id
    JOIN members m ON ur.member_id = m.member_id
    ORDER BY ri.equipment_id, ur.start_time
  `).all();

  for (let i = 0; i < usageRecords.length; i++) {
    for (let j = i + 1; j < usageRecords.length; j++) {
      const a = usageRecords[i];
      const b = usageRecords[j];

      if (a.equipment_id !== b.equipment_id) break;

      const aStart = moment(a.start_time);
      const aEnd = moment(a.end_time);
      const bStart = moment(b.start_time);
      const bEnd = moment(b.end_time);

      if (bStart.isBefore(aEnd) && aStart.isBefore(bEnd)) {
        const overlapStart = moment.max(aStart, bStart);
        const overlapEnd = moment.min(aEnd, bEnd);
        const overlapMinutes = overlapEnd.diff(overlapStart, 'minutes');

        const entityId = `${a.usage_id}_${b.usage_id}`;
        const existing = await db.prepare(`
          SELECT 1 FROM anomalies 
          WHERE anomaly_type = ? AND entity_id = ? AND is_resolved = 0
        `).get(ANOMALY_TYPES.USAGE_TIME_OVERLAP, entityId);

        if (!existing) {
          const anomalyId = uuidv4();
          await db.prepare(`
            INSERT INTO anomalies 
            (anomaly_id, anomaly_type, severity, entity_type, entity_id, 
             description, related_ids)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `).run(
            anomalyId,
            ANOMALY_TYPES.USAGE_TIME_OVERLAP,
            SEVERITY.HIGH,
            'USAGE_RECORD',
            entityId,
            `设备 [${a.equipment_name}] 存在时长重叠：${a.member_name}(${a.start_time}~${a.end_time}) 与 ${b.member_name}(${b.start_time}~${b.end_time}) 重叠 ${overlapMinutes} 分钟`,
            JSON.stringify({ 
              usage_ids: [a.usage_id, b.usage_id],
              equipment_id: a.equipment_id,
              member_ids: [a.member_id, b.member_id],
              order_id: a.order_id,
              overlap_minutes: overlapMinutes
            })
          );
          anomalies.push({ anomalyId, overlapMinutes, usageRecords: [a, b] });
        }
      }
    }
  }

  return anomalies;
};

const detectDamageUnallocated = async () => {
  const db = await getDb();
  const anomalies = [];

  const unallocatedDamages = await db.prepare(`
    SELECT 
      dr.damage_id,
      dr.order_id,
      dr.item_id,
      dr.equipment_id,
      dr.damage_description,
      dr.repair_cost,
      dr.is_allocated,
      dr.allocated_amount,
      ro.status as order_status,
      e.name as equipment_name
    FROM damage_records dr
    JOIN rental_orders ro ON dr.order_id = ro.order_id
    JOIN equipment e ON dr.equipment_id = e.equipment_id
    WHERE dr.is_allocated = 0
      AND dr.repair_cost > 0
      AND ro.status IN ('RETURNED', 'SETTLED', 'CLOSED')
  `).all();

  for (const damage of unallocatedDamages) {
    const existing = await db.prepare(`
      SELECT 1 FROM anomalies 
      WHERE anomaly_type = ? AND entity_id = ? AND is_resolved = 0
    `).get(ANOMALY_TYPES.DAMAGE_UNALLOCATED, damage.damage_id);

    if (!existing) {
      const anomalyId = uuidv4();
      await db.prepare(`
        INSERT INTO anomalies 
        (anomaly_id, anomaly_type, severity, entity_type, entity_id, 
         description, related_ids)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        anomalyId,
        ANOMALY_TYPES.DAMAGE_UNALLOCATED,
        SEVERITY.HIGH,
        'DAMAGE_RECORD',
        damage.damage_id,
        `设备 [${damage.equipment_name}] 损坏记录未分摊：${damage.damage_description}，维修费 ¥${damage.repair_cost.toFixed(2)}，租赁单状态：${damage.order_status}`,
        JSON.stringify({ 
          order_id: damage.order_id, 
          item_id: damage.item_id, 
          equipment_id: damage.equipment_id,
          repair_cost: damage.repair_cost
        })
      );
      anomalies.push({ anomalyId, damage });
    }
  }

  return anomalies;
};

const runAllChecks = async () => {
  const db = await getDb();
  const results = {};

  await db.transaction(async () => {
    results.depositMissingRefund = await detectDepositMissingRefund();
    results.usageTimeOverlap = await detectUsageTimeOverlap();
    results.damageUnallocated = await detectDamageUnallocated();
  });

  const unresolved = await db.prepare(`
    SELECT anomaly_type, COUNT(*) as cnt 
    FROM anomalies 
    WHERE is_resolved = 0 
    GROUP BY anomaly_type
  `).all();

  const typeCounts = {};
  let total = 0;
  unresolved.forEach(r => {
    typeCounts[r.anomaly_type] = r.cnt;
    total += r.cnt;
  });

  return {
    success: true,
    totalAnomalies: total,
    byType: typeCounts,
    newlyDetected: {
      depositMissingRefund: results.depositMissingRefund.length,
      usageTimeOverlap: results.usageTimeOverlap.length,
      damageUnallocated: results.damageUnallocated.length
    },
    details: results
  };
};

const getAnomalies = async (filters = {}) => {
  const db = await getDb();
  const conditions = [];
  const params = [];

  if (filters.anomaly_type) {
    conditions.push('anomaly_type = ?');
    params.push(filters.anomaly_type);
  }
  if (filters.severity) {
    conditions.push('severity = ?');
    params.push(filters.severity);
  }
  if (filters.is_resolved !== undefined) {
    conditions.push('is_resolved = ?');
    const isResolved = filters.is_resolved === true || filters.is_resolved === 'true' || filters.is_resolved === 1;
    params.push(isResolved ? 1 : 0);
  }
  if (filters.entity_type) {
    conditions.push('entity_type = ?');
    params.push(filters.entity_type);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  
  return await db.prepare(`
    SELECT * FROM anomalies ${whereClause}
    ORDER BY detected_at DESC
  `).all(...params);
};

const resolveAnomaly = async (anomalyId, resolutionNotes, operator = 'system') => {
  const db = await getDb();
  const anomaly = await db.prepare('SELECT * FROM anomalies WHERE anomaly_id = ?').get(anomalyId);
  
  if (!anomaly) {
    throw new Error(`Anomaly not found: ${anomalyId}`);
  }

  await db.prepare(`
    UPDATE anomalies 
    SET is_resolved = 1, resolved_at = datetime('now'), resolution_notes = ?
    WHERE anomaly_id = ?
  `).run(resolutionNotes || `Resolved by ${operator}`, anomalyId);

  return {
    success: true,
    anomalyId,
    resolvedAt: new Date().toISOString(),
    resolutionNotes
  };
};

const resolveAnomaliesByType = async (anomalyType, resolutionNotes, operator = 'system') => {
  const db = await getDb();
  
  const result = await db.prepare(`
    UPDATE anomalies 
    SET is_resolved = 1, resolved_at = datetime('now'), resolution_notes = ?
    WHERE anomaly_type = ? AND is_resolved = 0
  `).run(resolutionNotes || `Batch resolved by ${operator}`, anomalyType);

  return {
    success: true,
    anomalyType,
    resolvedCount: result.changes
  };
};

module.exports = {
  ANOMALY_TYPES,
  SEVERITY,
  detectDepositMissingRefund,
  detectUsageTimeOverlap,
  detectDamageUnallocated,
  runAllChecks,
  getAnomalies,
  resolveAnomaly,
  resolveAnomaliesByType
};
