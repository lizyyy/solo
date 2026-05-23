const { run, get, all } = require('../config/dbUtils');

class VehicleSubscription {
  static async create(data) {
    const result = await run(
      `INSERT INTO vehicle_subscriptions 
       (vehicle_id, plan_id, start_date, end_date, total_amount, paid_amount, status)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        data.vehicle_id,
        data.plan_id,
        data.start_date,
        data.end_date,
        data.total_amount,
        data.paid_amount || data.total_amount,
        data.status || 'active'
      ]
    );
    return result.lastID;
  }

  static async findActiveByVehicleId(vehicleId) {
    return await get(
      `SELECT * FROM vehicle_subscriptions 
       WHERE vehicle_id = ? AND status = 'active' AND end_date >= CURRENT_TIMESTAMP
       ORDER BY end_date DESC LIMIT 1`,
      [vehicleId]
    );
  }

  static async findByVehicleId(vehicleId) {
    return await all(
      `SELECT vs.*, mp.plan_name 
       FROM vehicle_subscriptions vs
       JOIN monthly_plans mp ON vs.plan_id = mp.id
       WHERE vs.vehicle_id = ? ORDER BY vs.created_at DESC`,
      [vehicleId]
    );
  }
}

module.exports = VehicleSubscription;
