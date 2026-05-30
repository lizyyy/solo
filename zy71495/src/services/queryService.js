const { getDb } = require('../db/connection');

const getMemberList = async (filters = {}) => {
  const db = await getDb();
  const conditions = [];
  const params = [];

  if (filters.is_active !== undefined) {
    conditions.push('is_active = ?');
    params.push(filters.is_active ? 1 : 0);
  }
  if (filters.role) {
    conditions.push('role = ?');
    params.push(filters.role);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  
  const members = await db.prepare(`
    SELECT * FROM members ${whereClause}
  `).all(...params);
  
  return members.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
};

const getEquipmentList = async (filters = {}) => {
  const db = await getDb();
  const conditions = [];
  const params = [];

  if (filters.status) {
    conditions.push('status = ?');
    params.push(filters.status);
  }
  if (filters.category) {
    conditions.push('category = ?');
    params.push(filters.category);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  
  return await db.prepare(`
    SELECT * FROM equipment ${whereClause}
    ORDER BY category, name ASC
  `).all(...params);
};

const getRentalOrderList = async (filters = {}) => {
  const db = await getDb();
  const conditions = [];
  const params = [];

  if (filters.status) {
    conditions.push('ro.status = ?');
    params.push(filters.status);
  }
  if (filters.batch_id) {
    conditions.push('ro.batch_id = ?');
    params.push(filters.batch_id);
  }
  if (filters.start_date) {
    conditions.push('ro.order_date >= ?');
    params.push(filters.start_date);
  }
  if (filters.end_date) {
    conditions.push('ro.order_date <= ?');
    params.push(filters.end_date);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  
  return await db.prepare(`
    SELECT 
      ro.*,
      br.batch_type,
      br.description as batch_description,
      (SELECT COUNT(*) FROM rental_items ri WHERE ri.order_id = ro.order_id) as item_count
    FROM rental_orders ro
    LEFT JOIN batch_records br ON ro.batch_id = br.batch_id
    ${whereClause}
    ORDER BY ro.order_date DESC, ro.created_at DESC
  `).all(...params);
};

const getRentalOrderDetail = async (orderId) => {
  const db = await getDb();
  
  const order = await db.prepare(`
    SELECT 
      ro.*,
      br.batch_id,
      br.batch_type,
      br.description as batch_description,
      br.created_at as batch_created_at
    FROM rental_orders ro
    LEFT JOIN batch_records br ON ro.batch_id = br.batch_id
    WHERE ro.order_id = ?
  `).get(orderId);

  if (!order) return null;

  const items = await db.prepare(`
    SELECT 
      ri.*,
      e.name as equipment_name,
      e.category as equipment_category,
      (SELECT SUM(duration_hours) FROM usage_records ur WHERE ur.item_id = ri.item_id) as total_usage_hours
    FROM rental_items ri
    JOIN equipment e ON ri.equipment_id = e.equipment_id
    WHERE ri.order_id = ?
    ORDER BY ri.created_at ASC
  `).all(orderId);

  for (const item of items) {
    item.usage_records = await db.prepare(`
      SELECT 
        ur.*,
        m.name as member_name,
        m.role as member_role
      FROM usage_records ur
      JOIN members m ON ur.member_id = m.member_id
      WHERE ur.item_id = ?
      ORDER BY ur.start_time ASC
    `).all(item.item_id);

    item.deposit = await db.prepare(`
      SELECT * FROM deposits WHERE item_id = ?
    `).get(item.item_id);
  }

  const damages = await db.prepare(`
    SELECT 
      dr.*,
      e.name as equipment_name
    FROM damage_records dr
    JOIN equipment e ON dr.equipment_id = e.equipment_id
    WHERE dr.order_id = ?
  `).all(orderId);

  const allocations = await db.prepare(`
    SELECT 
      ea.*,
      e.name as equipment_name,
      m.name as member_name
    FROM expense_allocations ea
    JOIN equipment e ON ea.equipment_id = e.equipment_id
    JOIN members m ON ea.member_id = m.member_id
    WHERE ea.order_id = ?
    ORDER BY ea.created_at ASC
  `).all(orderId);

  const stateTransitions = await db.prepare(`
    SELECT * FROM state_transitions 
    WHERE entity_type = 'RENTAL_ORDER' AND entity_id = ?
    ORDER BY created_at ASC
  `).all(orderId);

  return {
    order,
    items,
    damages,
    allocations,
    stateTransitions
  };
};

const getEquipmentUsageHistory = async (equipmentId, filters = {}) => {
  const db = await getDb();
  const conditions = ['ri.equipment_id = ?'];
  const params = [equipmentId];

  if (filters.start_date) {
    conditions.push('ur.start_time >= ?');
    params.push(filters.start_date);
  }
  if (filters.end_date) {
    conditions.push('ur.end_time <= ?');
    params.push(filters.end_date);
  }

  return await db.prepare(`
    SELECT 
      ur.*,
      m.name as member_name,
      ro.order_id,
      ro.order_date,
      e.name as equipment_name
    FROM usage_records ur
    JOIN rental_items ri ON ur.item_id = ri.item_id
    JOIN members m ON ur.member_id = m.member_id
    JOIN rental_orders ro ON ri.order_id = ro.order_id
    JOIN equipment e ON ri.equipment_id = e.equipment_id
    WHERE ${conditions.join(' AND ')}
    ORDER BY ur.start_time DESC
  `).all(...params);
};

const getMemberUsageHistory = async (memberId, filters = {}) => {
  const db = await getDb();
  const conditions = ['ur.member_id = ?'];
  const params = [memberId];

  if (filters.start_date) {
    conditions.push('ur.start_time >= ?');
    params.push(filters.start_date);
  }
  if (filters.end_date) {
    conditions.push('ur.end_time <= ?');
    params.push(filters.end_date);
  }

  return await db.prepare(`
    SELECT 
      ur.*,
      e.name as equipment_name,
      e.category as equipment_category,
      ro.order_id,
      ro.order_date,
      m.name as member_name
    FROM usage_records ur
    JOIN rental_items ri ON ur.item_id = ri.item_id
    JOIN equipment e ON ri.equipment_id = e.equipment_id
    JOIN rental_orders ro ON ri.order_id = ro.order_id
    JOIN members m ON ur.member_id = m.member_id
    WHERE ${conditions.join(' AND ')}
    ORDER BY ur.start_time DESC
  `).all(...params);
};

const getDepositList = async (filters = {}) => {
  const db = await getDb();
  const conditions = [];
  const params = [];

  if (filters.status) {
    conditions.push('d.status = ?');
    params.push(filters.status);
  }
  if (filters.order_id) {
    conditions.push('d.order_id = ?');
    params.push(filters.order_id);
  }
  if (filters.equipment_id) {
    conditions.push('d.equipment_id = ?');
    params.push(filters.equipment_id);
  }
  if (filters.unrefunded_only) {
    conditions.push('(d.collected_amount - d.refunded_amount - d.deducted_amount) > 0');
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  
  return await db.prepare(`
    SELECT 
      d.*,
      e.name as equipment_name,
      ro.order_id,
      ro.order_date,
      ro.status as order_status,
      (d.collected_amount - d.refunded_amount - d.deducted_amount) as remaining_amount
    FROM deposits d
    JOIN equipment e ON d.equipment_id = e.equipment_id
    JOIN rental_orders ro ON d.order_id = ro.order_id
    ${whereClause}
    ORDER BY d.created_at DESC
  `).all(...params);
};

const getOrderTrace = async (orderId) => {
  const db = await getDb();
  
  const order = await db.prepare(`
    SELECT ro.*, br.*
    FROM rental_orders ro
    LEFT JOIN batch_records br ON ro.batch_id = br.batch_id
    WHERE ro.order_id = ?
  `).get(orderId);

  if (!order) return null;

  const items = await db.prepare(`
    SELECT 
      ri.item_id,
      ri.equipment_id,
      e.name as equipment_name,
      ur.usage_id,
      ur.member_id,
      m.name as member_name,
      ur.start_time,
      ur.end_time,
      ur.duration_hours,
      ea.allocation_id,
      ea.allocated_amount,
      ea.allocation_type
    FROM rental_items ri
    JOIN equipment e ON ri.equipment_id = e.equipment_id
    LEFT JOIN usage_records ur ON ri.item_id = ur.item_id
    LEFT JOIN members m ON ur.member_id = m.member_id
    LEFT JOIN expense_allocations ea ON ur.usage_id = ea.usage_id
    WHERE ri.order_id = ?
    ORDER BY ri.created_at, ur.start_time
  `).all(orderId);

  const stateHistory = await db.prepare(`
    SELECT * FROM state_transitions 
    WHERE entity_type = 'RENTAL_ORDER' AND entity_id = ?
    ORDER BY created_at ASC
  `).all(orderId);

  return {
    order,
    traceItems: items,
    stateHistory
  };
};

const getStatistics = async (filters = {}) => {
  const db = await getDb();
  const conditions = [];
  const params = [];

  if (filters.start_date) {
    conditions.push('order_date >= ?');
    params.push(filters.start_date);
  }
  if (filters.end_date) {
    conditions.push('order_date <= ?');
    params.push(filters.end_date);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const orderStats = await db.prepare(`
    SELECT 
      COUNT(*) as total_orders,
      COUNT(CASE WHEN status = 'DRAFT' THEN 1 END) as draft_orders,
      COUNT(CASE WHEN status = 'CONFIRMED' THEN 1 END) as confirmed_orders,
      COUNT(CASE WHEN status = 'IN_USE' THEN 1 END) as in_use_orders,
      COUNT(CASE WHEN status = 'RETURNED' THEN 1 END) as returned_orders,
      COUNT(CASE WHEN status = 'SETTLED' THEN 1 END) as settled_orders,
      COUNT(CASE WHEN status = 'CLOSED' THEN 1 END) as closed_orders,
      COUNT(CASE WHEN status = 'CANCELLED' THEN 1 END) as cancelled_orders,
      COALESCE(SUM(total_amount), 0) as total_rental_amount,
      COALESCE(SUM(total_deposit), 0) as total_deposit_collected,
      COALESCE(SUM(total_allocated), 0) as total_allocated
    FROM rental_orders
    ${whereClause}
  `).get(...params);

  const equipmentStats = await db.prepare(`
    SELECT 
      COUNT(*) as total_equipment,
      COUNT(CASE WHEN status = 'AVAILABLE' THEN 1 END) as available_equipment,
      COUNT(CASE WHEN status = 'RENTED' THEN 1 END) as rented_equipment,
      COUNT(CASE WHEN status = 'DAMAGED' THEN 1 END) as damaged_equipment,
      COUNT(CASE WHEN status = 'IN_REPAIR' THEN 1 END) as in_repair_equipment
    FROM equipment
  `).get();

  const memberStats = await db.prepare(`
    SELECT 
      COUNT(*) as total_members,
      COUNT(CASE WHEN is_active = 1 THEN 1 END) as active_members
    FROM members
  `).get();

  const anomalyStats = await db.prepare(`
    SELECT 
      COUNT(*) as total_anomalies,
      COUNT(CASE WHEN is_resolved = 0 THEN 1 END) as unresolved_anomalies,
      COUNT(CASE WHEN anomaly_type = 'DEPOSIT_MISSING_REFUND' AND is_resolved = 0 THEN 1 END) as missing_refund_anomalies,
      COUNT(CASE WHEN anomaly_type = 'USAGE_TIME_OVERLAP' AND is_resolved = 0 THEN 1 END) as overlap_anomalies,
      COUNT(CASE WHEN anomaly_type = 'DAMAGE_UNALLOCATED' AND is_resolved = 0 THEN 1 END) as unallocated_damage_anomalies
    FROM anomalies
  `).get();

  return {
    orderStats,
    equipmentStats,
    memberStats,
    anomalyStats
  };
};

module.exports = {
  getMemberList,
  getEquipmentList,
  getRentalOrderList,
  getRentalOrderDetail,
  getEquipmentUsageHistory,
  getMemberUsageHistory,
  getDepositList,
  getOrderTrace,
  getStatistics
};
