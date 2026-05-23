const { run, get, all } = require('../models/database');
const helpers = require('../utils/helpers');

async function getOrderById(id) {
  return await get('SELECT * FROM service_orders WHERE id = ?', [id]);
}

async function getOrderByNo(orderNo) {
  return await get('SELECT * FROM service_orders WHERE order_no = ?', [orderNo]);
}

async function listOrders(filters = {}) {
  let query = 'SELECT so.*, ep.name as elderly_name, n.name as nurse_name FROM service_orders so LEFT JOIN elderly_profiles ep ON so.elderly_id = ep.elderly_id LEFT JOIN nurses n ON so.nurse_id = n.nurse_id WHERE 1=1';
  const params = [];

  if (filters.batch_id) {
    query += ' AND so.batch_id = ?';
    params.push(filters.batch_id);
  }
  if (filters.status) {
    query += ' AND so.status = ?';
    params.push(filters.status);
  }
  if (filters.elderly_id) {
    query += ' AND so.elderly_id = ?';
    params.push(filters.elderly_id);
  }
  if (filters.nurse_id) {
    query += ' AND so.nurse_id = ?';
    params.push(filters.nurse_id);
  }
  if (filters.district) {
    query += ' AND so.district = ?';
    params.push(filters.district);
  }
  if (filters.service_type) {
    query += ' AND so.service_type = ?';
    params.push(filters.service_type);
  }

  query += ' ORDER BY so.created_at DESC';
  return await all(query, params);
}

async function assignNurse(orderId, nurseId, handledBy) {
  const order = await getOrderById(orderId);
  if (!order) throw new Error('服务单不存在');

  const nurse = await get('SELECT * FROM nurses WHERE nurse_id = ?', [nurseId]);
  if (!nurse) throw new Error('护士不存在');

  const skillCheck = helpers.checkSkillMatch(nurse.skills, order.service_items);
  const districtMatch = helpers.checkDistrictMatch(nurse.district, order.district);
  const distance = helpers.calculateDistance(nurse.district, order.address);

  let status = order.status;
  let action = 'assign_nurse';
  let reason = `分配护士: ${nurse.name}`;

  if (!skillCheck.matched) {
    reason += ` (技能不匹配: 缺少${skillCheck.missing.join(',')})`;
  }
  if (!districtMatch) {
    reason += ` (跨区域: 护士${nurse.district} -> 服务${order.district}, 距离约${distance.toFixed(1)}公里)`;
  }

  await run(
    `UPDATE service_orders 
    SET nurse_id = ?, skill_match_status = ?, route_status = ?, distance_km = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?`,
    [nurseId, skillCheck.matched ? 'matched' : 'unmatched', districtMatch ? 'same_district' : 'cross_district', distance, orderId]
  );

  await insertTrackRecord(orderId, order.batch_id, status, action, reason, handledBy, {
    nurse_id: nurseId,
    nurse_name: nurse.name,
    skill_check: skillCheck,
    district_match: districtMatch,
    distance_km: distance
  });

  return await getOrderById(orderId);
}

async function processOrder(orderId, handledBy, reason = '') {
  return await updateOrderStatus(orderId, 'processing', 'process', reason || '开始处理', handledBy);
}

async function approveOrder(orderId, handledBy, reason = '') {
  return await updateOrderStatus(orderId, 'approved', 'approve', reason || '审核通过', handledBy);
}

async function returnOrder(orderId, handledBy, reason) {
  if (!reason) throw new Error('退回原因不能为空');
  return await updateOrderStatus(orderId, 'returned', 'return', reason, handledBy);
}

async function cancelOrder(orderId, handledBy, reason) {
  if (!reason) throw new Error('取消原因不能为空');
  
  const order = await getOrderById(orderId);
  if (!order) throw new Error('服务单不存在');

  await run(
    `UPDATE service_orders 
    SET status = 'cancelled', cancel_reason = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?`,
    [reason, orderId]
  );

  await insertTrackRecord(orderId, order.batch_id, 'cancelled', 'cancel', reason, handledBy);

  return await getOrderById(orderId);
}

async function replaceNurse(orderId, newNurseId, handledBy, reason) {
  if (!reason) throw new Error('补位原因不能为空');

  const order = await getOrderById(orderId);
  if (!order) throw new Error('服务单不存在');

  const oldNurseId = order.nurse_id;
  const nurse = await get('SELECT * FROM nurses WHERE nurse_id = ?', [newNurseId]);
  if (!nurse) throw new Error('新护士不存在');

  await run(
    `UPDATE service_orders 
    SET nurse_id = ?, replacement_nurse_id = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?`,
    [newNurseId, oldNurseId, orderId]
  );

  await insertTrackRecord(orderId, order.batch_id, order.status, 'replace_nurse', reason, handledBy, {
    old_nurse_id: oldNurseId,
    new_nurse_id: newNurseId,
    new_nurse_name: nurse.name
  });

  return await getOrderById(orderId);
}

async function completeOrder(orderId, handledBy, reason = '') {
  return await updateOrderStatus(orderId, 'completed', 'complete', reason || '服务完成', handledBy);
}

async function updateOrderStatus(orderId, status, action, reason, handledBy) {
  const order = await getOrderById(orderId);
  if (!order) throw new Error('服务单不存在');

  await run(
    `UPDATE service_orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [status, orderId]
  );

  await insertTrackRecord(orderId, order.batch_id, status, action, reason, handledBy);

  await updateBatchProcessedCount(order.batch_id);

  return await getOrderById(orderId);
}

async function insertTrackRecord(orderId, batchId, status, action, reason, handledBy, extraInfo = {}) {
  const order = await getOrderById(orderId);
  await run(
    `INSERT INTO track_records 
    (record_no, service_order_id, batch_id, elderly_id, nurse_id, service_type, status, action, reason, handled_by, route_info, skill_info)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      helpers.generateRecordNo(),
      orderId,
      batchId,
      order.elderly_id,
      order.nurse_id,
      order.service_type,
      status,
      action,
      reason,
      handledBy,
      JSON.stringify({ distance_km: order.distance_km, district: order.district }),
      JSON.stringify({ skill_match: order.skill_match_status })
    ]
  );
}

async function updateBatchProcessedCount(batchId) {
  if (!batchId) return;
  
  const count = await get(
    `SELECT COUNT(*) as cnt FROM service_orders WHERE batch_id = ? AND status != 'pending'`,
    [batchId]
  );

  await run('UPDATE batches SET processed_count = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [count.cnt, batchId]);
}

module.exports = {
  getOrderById,
  getOrderByNo,
  listOrders,
  assignNurse,
  processOrder,
  approveOrder,
  returnOrder,
  cancelOrder,
  replaceNurse,
  completeOrder
};
