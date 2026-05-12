const { db } = require('../database');

async function getOperationLogs(orderId = null, limit = 50) {
  let query = 'SELECT * FROM operation_logs';
  const params = [];

  if (orderId) {
    query += ' WHERE order_id = ?';
    params.push(orderId);
  }

  query += ' ORDER BY created_at DESC LIMIT ?';
  params.push(limit);

  const logs = await db.all(query, params);

  return logs.map(log => ({
    ...log,
    details: log.details ? JSON.parse(log.details) : null
  }));
}

async function getOrderTimeline(orderId) {
  const logs = await getOperationLogs(orderId);
  return logs.reverse();
}

async function getCurrentAuthorizations() {
  const now = Date.now();
  return await db.all(`
    SELECT a.*, o.spot_number, o.renter_name
    FROM access_authorizations a
    JOIN orders o ON a.order_id = o.id
    WHERE a.status = 'active'
      AND a.start_time <= ?
      AND a.end_time >= ?
    ORDER BY a.created_at DESC
  `, [now, now]);
}

async function getDashboardStats() {
  const totalSpots = await db.get('SELECT COUNT(*) as count FROM parking_spots');
  const availableSpots = await db.get("SELECT COUNT(*) as count FROM parking_spots WHERE status = 'available'");

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayTimestamp = todayStart.getTime();

  const todayOrders = await db.get(`
    SELECT COUNT(*) as count, SUM(total_amount) as total
    FROM orders
    WHERE created_at >= ?
  `, [todayTimestamp]);

  const pendingOrders = await db.get("SELECT COUNT(*) as count FROM orders WHERE status = 'pending'");
  const activeAuthorizations = await db.get("SELECT COUNT(*) as count FROM access_authorizations WHERE status = 'active'");

  return {
    totalParkingSpots: totalSpots.count,
    availableParkingSpots: availableSpots.count,
    todayOrders: todayOrders.count || 0,
    todayRevenue: todayOrders.total || 0,
    pendingOrders: pendingOrders.count,
    activeAuthorizations: activeAuthorizations.count
  };
}

async function searchOrdersByLicensePlate(licensePlate) {
  return await db.all(`
    SELECT * FROM orders
    WHERE license_plate = ?
    ORDER BY created_at DESC
  `, [licensePlate]);
}

async function getSpotAvailability(spotId, startTime, endTime) {
  const spot = await db.get('SELECT * FROM parking_spots WHERE id = ?', [spotId]);
  if (!spot) {
    throw new Error('车位不存在');
  }

  const conflicts = await db.all(`
    SELECT id, spot_number, start_time, end_time, status
    FROM orders
    WHERE spot_id = ?
      AND status NOT IN ('cancelled', 'refunded')
      AND (
        (start_time < ? AND end_time > ?)
        OR (start_time >= ? AND start_time < ?)
        OR (end_time > ? AND end_time <= ?)
      )
  `, [spotId, endTime, startTime, startTime, endTime, startTime, endTime]);

  return {
    spot,
    isAvailable: conflicts.length === 0,
    conflictingOrders: conflicts
  };
}

module.exports = {
  getOperationLogs,
  getOrderTimeline,
  getCurrentAuthorizations,
  getDashboardStats,
  searchOrdersByLicensePlate,
  getSpotAvailability
};
