const { run, get, all } = require('../config/dbUtils');

class MonthlyPlan {
  static async create(data) {
    const result = await run(
      `INSERT INTO monthly_plans (plan_name, price, duration_days, description, is_active)
       VALUES (?, ?, ?, ?, ?)`,
      [
        data.plan_name,
        data.price,
        data.duration_days,
        data.description || null,
        data.is_active !== undefined ? data.is_active : 1
      ]
    );
    return result.lastID;
  }

  static async findById(id) {
    return await get('SELECT * FROM monthly_plans WHERE id = ?', [id]);
  }

  static async listActive() {
    return await all('SELECT * FROM monthly_plans WHERE is_active = 1 ORDER BY price');
  }
}

module.exports = MonthlyPlan;
