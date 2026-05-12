const db = require('../models/database');

class EquipmentService {
  static async createEquipment(data) {
    return new Promise((resolve, reject) => {
      const { equipment_code, name, category, spec, daily_rate, deposit_amount, warehouse } = data;
      db.run(
        `INSERT INTO equipment (equipment_code, name, category, spec, daily_rate, deposit_amount, warehouse)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [equipment_code, name, category, spec, daily_rate, deposit_amount, warehouse],
        function(err) {
          if (err) reject(err);
          else resolve({ id: this.lastID, ...data });
        }
      );
    });
  }

  static async getEquipmentById(id) {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM equipment WHERE id = ?', [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  static async getEquipmentByCode(equipmentCode) {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM equipment WHERE equipment_code = ?', [equipmentCode], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  static async listEquipment(filters = {}) {
    return new Promise((resolve, reject) => {
      let sql = 'SELECT * FROM equipment WHERE 1=1';
      const params = [];
      
      if (filters.status) {
        sql += ' AND status = ?';
        params.push(filters.status);
      }
      if (filters.category) {
        sql += ' AND category = ?';
        params.push(filters.category);
      }
      
      db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  static async updateEquipmentStatus(id, status) {
    return new Promise((resolve, reject) => {
      db.run(
        'UPDATE equipment SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [status, id],
        (err) => err ? reject(err) : resolve()
      );
    });
  }

  static async checkAvailability(equipmentId) {
    const equipment = await this.getEquipmentById(equipmentId);
    if (!equipment) return { available: false, reason: '设备不存在' };
    
    const activeLocks = await new Promise((resolve, reject) => {
      db.get(
        'SELECT COUNT(*) as count FROM stock_locks WHERE equipment_id = ? AND is_active = 1',
        [equipmentId],
        (err, row) => err ? reject(err) : resolve(row)
      );
    });
    
    if (activeLocks.count > 0) {
      return { available: false, reason: '设备已被锁定' };
    }
    
    if (equipment.status !== 'available') {
      return { available: false, reason: `设备状态为: ${equipment.status}` };
    }
    
    return { available: true, equipment };
  }
}

module.exports = EquipmentService;
