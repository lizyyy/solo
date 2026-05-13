const db = require('../config/database');

class QuotaModel {
  static async findByCode(quotaCode, client = null) {
    const query = db || client;
    const result = await query.query(
      'SELECT * FROM quotas WHERE quota_code = $1',
      [quotaCode]
    );
    return result.rows[0];
  }

  static async findById(id, client = null) {
    const query = db || client;
    const result = await query.query(
      'SELECT * FROM quotas WHERE id = $1',
      [id]
    );
    return result.rows[0];
  }

  static async updateOccupiedAmount(quotaId, amount, expectedVersion, client) {
    const result = await client.query(`
      UPDATE quotas 
      SET 
        occupied_amount = occupied_amount + $2,
        available_amount = available_amount - $2,
        version = version + 1
      WHERE id = $1 
        AND version = $3
        AND available_amount >= $2
      RETURNING *
    `, [quotaId, amount, expectedVersion]);
    return result.rows[0];
  }

  static async releaseOccupiedAmount(quotaId, amount, expectedVersion, client) {
    const result = await client.query(`
      UPDATE quotas 
      SET 
        occupied_amount = occupied_amount - $2,
        available_amount = available_amount + $2,
        version = version + 1
      WHERE id = $1 
        AND version = $3
        AND occupied_amount >= $2
      RETURNING *
    `, [quotaId, amount, expectedVersion]);
    return result.rows[0];
  }

  static async deductFromOccupied(quotaId, amount, expectedVersion, client) {
    const result = await client.query(`
      UPDATE quotas 
      SET 
        used_amount = used_amount + $2,
        occupied_amount = occupied_amount - $2,
        version = version + 1
      WHERE id = $1 
        AND version = $3
        AND occupied_amount >= $2
      RETURNING *
    `, [quotaId, amount, expectedVersion]);
    return result.rows[0];
  }

  static async getStatistics(client = null) {
    const query = db || client;
    const result = await query.query(`
      SELECT 
        COUNT(*) as total_quotas,
        SUM(total_amount) as total_amount,
        SUM(used_amount) as total_used,
        SUM(occupied_amount) as total_occupied,
        SUM(available_amount) as total_available
      FROM quotas
    `);
    return result.rows[0];
  }
}

module.exports = QuotaModel;
