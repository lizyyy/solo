const { run, get, all } = require('../config/dbUtils');

class Vehicle {
  static async create(data) {
    const result = await run(
      `INSERT INTO vehicles (plate_number, owner_name, owner_phone, balance, status)
       VALUES (?, ?, ?, ?, ?)`,
      [
        data.plate_number,
        data.owner_name || null,
        data.owner_phone || null,
        data.balance || 0.00,
        data.status || 'active'
      ]
    );
    return result.lastID;
  }

  static async findByPlate(plateNumber) {
    return await get('SELECT * FROM vehicles WHERE plate_number = ?', [plateNumber]);
  }

  static async findById(id) {
    return await get('SELECT * FROM vehicles WHERE id = ?', [id]);
  }

  static async updateBalance(id, newBalance) {
    return await run(
      `UPDATE vehicles SET balance = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [newBalance, id]
    );
  }

  static async list(page = 1, pageSize = 20) {
    const offset = (page - 1) * pageSize;
    return await all(
      'SELECT * FROM vehicles ORDER BY created_at DESC LIMIT ? OFFSET ?',
      [pageSize, offset]
    );
  }
}

module.exports = Vehicle;
