const { getDatabase } = require('./database');

const ANOMALY_TYPES = {
  SHUTTER_ABNORMAL: 'shutter_abnormal',
  ACCESSORY_MISSING: 'accessory_missing',
  PHOTO_MISSING: 'photo_missing',
  DUPLICATE_REPAIR: 'duplicate_repair'
};

function checkShutterAbnormal() {
  const db = getDatabase();
  const anomalies = [];
  
  const orders = db.prepare(`
    SELECT ro.*, st.shutter_count, st.test_date 
    FROM repair_orders ro
    LEFT JOIN shutter_tests st ON ro.body_serial = st.body_serial
    WHERE ro.status NOT IN ('completed', 'cancelled')
  `).all();
  
  for (const order of orders) {
    if (order.shutter_count === null || order.shutter_count === undefined) {
      continue;
    }
    
    const isAbnormal = order.shutter_count < 0 || order.shutter_count > 1000000;
    
    if (isAbnormal) {
      anomalies.push({
        anomaly_type: ANOMALY_TYPES.SHUTTER_ABNORMAL,
        body_serial: order.body_serial,
        description: `快门次数异常: ${order.shutter_count} 次，超出正常范围`,
        reference_id: order.order_no
      });
    }
  }
  
  return anomalies;
}

function checkAccessoryMissing() {
  const db = getDatabase();
  const anomalies = [];
  
  const pendingAccessories = db.prepare(`
    SELECT * FROM accessories 
    WHERE status != 'arrived' 
    AND (arrived_date IS NULL OR arrived_date = '')
  `).all();
  
  for (const acc of pendingAccessories) {
    anomalies.push({
      anomaly_type: ANOMALY_TYPES.ACCESSORY_MISSING,
      body_serial: acc.body_serial,
      description: `配件未到货: ${acc.part_name} (编号: ${acc.part_id})`,
      reference_id: acc.part_id
    });
  }
  
  return anomalies;
}

function checkPhotoMissing() {
  const db = getDatabase();
  const anomalies = [];
  
  const orders = db.prepare(`
    SELECT ro.*, COUNT(rp.id) as photo_count
    FROM repair_orders ro
    LEFT JOIN repair_photos rp ON ro.body_serial = rp.body_serial
    WHERE ro.status NOT IN ('completed', 'cancelled')
    GROUP BY ro.id
  `).all();
  
  for (const order of orders) {
    if (order.photo_count === 0) {
      anomalies.push({
        anomaly_type: ANOMALY_TYPES.PHOTO_MISSING,
        body_serial: order.body_serial,
        description: `维修照片缺失: 订单 ${order.order_no} 暂无关联照片`,
        reference_id: order.order_no
      });
    }
  }
  
  return anomalies;
}

function checkDuplicateRepair() {
  const db = getDatabase();
  const anomalies = [];
  
  const serialGroups = db.prepare(`
    SELECT body_serial, COUNT(*) as order_count, GROUP_CONCAT(order_no) as order_numbers
    FROM repair_orders
    WHERE status NOT IN ('cancelled')
    GROUP BY body_serial
    HAVING COUNT(*) > 1
  `).all();
  
  for (const group of serialGroups) {
    anomalies.push({
      anomaly_type: ANOMALY_TYPES.DUPLICATE_REPAIR,
      body_serial: group.body_serial,
      description: `同机身重复送修: 存在 ${group.order_count} 个订单 (${group.order_numbers})`,
      reference_id: group.order_numbers
    });
  }
  
  return anomalies;
}

function runAllChecks() {
  const db = getDatabase();
  
  db.exec(`DELETE FROM anomalies WHERE resolved = 0`);
  
  const allAnomalies = [
    ...checkShutterAbnormal(),
    ...checkAccessoryMissing(),
    ...checkPhotoMissing(),
    ...checkDuplicateRepair()
  ];
  
  const insertStmt = db.prepare(`
    INSERT INTO anomalies (anomaly_type, body_serial, description, reference_id)
    VALUES (@anomaly_type, @body_serial, @description, @reference_id)
  `);
  
  const transaction = db.transaction((items) => {
    for (const item of items) {
      insertStmt.run(item);
    }
  });
  
  if (allAnomalies.length > 0) {
    transaction(allAnomalies);
  }
  
  return {
    total: allAnomalies.length,
    byType: {
      shutter_abnormal: allAnomalies.filter(a => a.anomaly_type === ANOMALY_TYPES.SHUTTER_ABNORMAL).length,
      accessory_missing: allAnomalies.filter(a => a.anomaly_type === ANOMALY_TYPES.ACCESSORY_MISSING).length,
      photo_missing: allAnomalies.filter(a => a.anomaly_type === ANOMALY_TYPES.PHOTO_MISSING).length,
      duplicate_repair: allAnomalies.filter(a => a.anomaly_type === ANOMALY_TYPES.DUPLICATE_REPAIR).length
    },
    anomalies: allAnomalies
  };
}

function markNotified(orderNo, notified = true) {
  const db = getDatabase();
  const result = db.prepare(`
    UPDATE repair_orders 
    SET notified = ?, updated_at = CURRENT_TIMESTAMP 
    WHERE order_no = ?
  `).run(notified ? 1 : 0, orderNo);
  
  return {
    success: result.changes > 0,
    changes: result.changes
  };
}

function updateOrderStatus(orderNo, status) {
  const db = getDatabase();
  const validStatuses = ['pending', 'in_progress', 'waiting_parts', 'completed', 'cancelled'];
  
  if (!validStatuses.includes(status)) {
    return { success: false, error: '无效的状态值' };
  }
  
  const result = db.prepare(`
    UPDATE repair_orders 
    SET status = ?, updated_at = CURRENT_TIMESTAMP 
    WHERE order_no = ?
  `).run(status, orderNo);
  
  return {
    success: result.changes > 0,
    changes: result.changes
  };
}

function resolveAnomaly(anomalyId) {
  const db = getDatabase();
  const result = db.prepare(`
    UPDATE anomalies 
    SET resolved = 1 
    WHERE id = ?
  `).run(anomalyId);
  
  return {
    success: result.changes > 0,
    changes: result.changes
  };
}

function getOrdersBySerial(bodySerial) {
  const db = getDatabase();
  return db.prepare(`
    SELECT * FROM repair_orders WHERE body_serial = ? ORDER BY receive_date DESC
  `).all(bodySerial);
}

function getFullOrderInfo(orderNo) {
  const db = getDatabase();
  
  const order = db.prepare(`SELECT * FROM repair_orders WHERE order_no = ?`).get(orderNo);
  if (!order) return null;
  
  const shutterTests = db.prepare(`
    SELECT * FROM shutter_tests WHERE body_serial = ? ORDER BY test_date DESC
  `).all(order.body_serial);
  
  const accessories = db.prepare(`
    SELECT * FROM accessories WHERE body_serial = ? ORDER BY ordered_date DESC
  `).all(order.body_serial);
  
  const photos = db.prepare(`
    SELECT * FROM repair_photos WHERE body_serial = ? ORDER BY created_at DESC
  `).all(order.body_serial);
  
  const anomalies = db.prepare(`
    SELECT * FROM anomalies WHERE body_serial = ? AND resolved = 0
  `).all(order.body_serial);
  
  return {
    order,
    shutterTests,
    accessories,
    photos,
    anomalies
  };
}

function getAllOrders(status = null) {
  const db = getDatabase();
  let query = `SELECT * FROM repair_orders`;
  const params = [];
  
  if (status) {
    query += ` WHERE status = ?`;
    params.push(status);
  }
  query += ` ORDER BY receive_date DESC`;
  
  return db.prepare(query).all(...params);
}

function getUnresolvedAnomalies() {
  const db = getDatabase();
  return db.prepare(`
    SELECT * FROM anomalies WHERE resolved = 0 ORDER BY created_at DESC
  `).all();
}

module.exports = {
  checkShutterAbnormal,
  checkAccessoryMissing,
  checkPhotoMissing,
  checkDuplicateRepair,
  runAllChecks,
  markNotified,
  updateOrderStatus,
  resolveAnomaly,
  getOrdersBySerial,
  getFullOrderInfo,
  getAllOrders,
  getUnresolvedAnomalies,
  ANOMALY_TYPES
};
