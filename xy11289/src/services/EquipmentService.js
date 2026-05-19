const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');

class EquipmentService {
  static async logOperation(recordId, action, result, reason, operator) {
    return new Promise((resolve, reject) => {
      const logId = uuidv4();
      db.run(
        'INSERT INTO operation_logs (id, record_id, action, result, reason, operator) VALUES (?, ?, ?, ?, ?, ?)',
        [logId, recordId, action, result, reason, operator],
        (err) => {
          if (err) reject(err);
          else resolve(logId);
        }
      );
    });
  }

  static async getEquipmentByBarcode(barcode) {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT e.*, b.name as booth_name FROM equipments e 
         LEFT JOIN booths b ON e.current_booth_id = b.id 
         WHERE e.barcode = ?`,
        [barcode],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });
  }

  static async checkDuplicateScan(equipmentId, toBoothId, operator) {
    return new Promise((resolve, reject) => {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      db.get(
        `SELECT * FROM borrow_records 
         WHERE equipment_id = ? AND to_booth_id = ? AND operator = ? 
         AND created_at > ? AND status = 'confirmed'`,
        [equipmentId, toBoothId, operator, fiveMinutesAgo],
        (err, row) => {
          if (err) reject(err);
          else resolve(!!row);
        }
      );
    });
  }

  static async borrowEquipment(barcode, toBoothId, operator, remark = '') {
    const equipment = await this.getEquipmentByBarcode(barcode);
    
    if (!equipment) {
      await this.logOperation(null, 'borrow', 'rejected', '设备不存在', operator);
      return { success: false, reason: '设备不存在', code: 'EQUIPMENT_NOT_FOUND' };
    }

    if (equipment.status === 'damaged') {
      await this.logOperation(null, 'borrow', 'rejected', '设备已损坏，无法借用', operator);
      return { success: false, reason: '设备已损坏，无法借用', code: 'EQUIPMENT_DAMAGED' };
    }

    const isDuplicate = await this.checkDuplicateScan(equipment.id, toBoothId, operator);
    if (isDuplicate) {
      await this.logOperation(null, 'borrow', 'rejected', '5分钟内重复扫码借用', operator);
      return { success: false, reason: '5分钟内重复扫码借用', code: 'DUPLICATE_SCAN' };
    }

    const fromBoothId = equipment.current_booth_id;

    if (fromBoothId === toBoothId) {
      await this.logOperation(null, 'borrow', 'rejected', '设备已在目标展位', operator);
      return { success: false, reason: '设备已在目标展位', code: 'SAME_BOOTH' };
    }

    return new Promise((resolve, reject) => {
      db.serialize(async () => {
        try {
          const recordId = uuidv4();
          
          db.run('BEGIN TRANSACTION');

          db.run(
            `INSERT INTO borrow_records (id, equipment_id, from_booth_id, to_booth_id, operator, operation_type, status, remark) 
             VALUES (?, ?, ?, ?, ?, 'borrow', 'confirmed', ?)`,
            [recordId, equipment.id, fromBoothId, toBoothId, operator, remark]
          );

          db.run(
            'UPDATE equipments SET current_booth_id = ?, status = ? WHERE id = ?',
            [toBoothId, 'in_use', equipment.id]
          );

          await this.logOperation(recordId, 'borrow', 'approved', fromBoothId ? '跨展位借用成功' : '从仓库借用成功', operator);

          db.run('COMMIT');

          resolve({
            success: true,
            reason: fromBoothId ? '跨展位借用成功' : '从仓库借用成功',
            recordId,
            equipment: {
              barcode: equipment.barcode,
              name: equipment.name,
              type: equipment.type
            }
          });
        } catch (err) {
          db.run('ROLLBACK');
          reject(err);
        }
      });
    });
  }

  static async returnEquipment(barcode, toBoothId, operator, damageLevel = null, damageFee = 0, remark = '') {
    const equipment = await this.getEquipmentByBarcode(barcode);
    
    if (!equipment) {
      await this.logOperation(null, 'return', 'rejected', '设备不存在', operator);
      return { success: false, reason: '设备不存在', code: 'EQUIPMENT_NOT_FOUND' };
    }

    const fromBoothId = equipment.current_booth_id;

    if (fromBoothId === toBoothId) {
      await this.logOperation(null, 'return', 'rejected', '设备已在目标位置', operator);
      return { success: false, reason: '设备已在目标位置', code: 'SAME_BOOTH' };
    }

    const isDuplicate = await this.checkDuplicateScan(equipment.id, toBoothId, operator);
    if (isDuplicate) {
      await this.logOperation(null, 'return', 'rejected', '5分钟内重复扫码归还', operator);
      return { success: false, reason: '5分钟内重复扫码归还', code: 'DUPLICATE_SCAN' };
    }

    return new Promise((resolve, reject) => {
      db.serialize(async () => {
        try {
          const recordId = uuidv4();
          const newStatus = damageLevel ? 'damaged' : 'available';
          let reason = '归还成功';
          
          if (damageLevel) {
            reason = `归还成功，损坏等级: ${damageLevel}，扣减费用: ¥${damageFee}`;
          }

          db.run('BEGIN TRANSACTION');

          db.run(
            `INSERT INTO borrow_records (id, equipment_id, from_booth_id, to_booth_id, operator, operation_type, status, remark, damage_level, damage_fee) 
             VALUES (?, ?, ?, ?, ?, 'return', 'confirmed', ?, ?, ?)`,
            [recordId, equipment.id, fromBoothId, toBoothId, operator, remark, damageLevel, damageFee]
          );

          db.run(
            'UPDATE equipments SET current_booth_id = ?, status = ? WHERE id = ?',
            [toBoothId, newStatus, equipment.id]
          );

          await this.logOperation(recordId, 'return', 'approved', reason, operator);

          db.run('COMMIT');

          resolve({
            success: true,
            reason,
            recordId,
            equipment: {
              barcode: equipment.barcode,
              name: equipment.name,
              type: equipment.type
            },
            damage: damageLevel ? { level: damageLevel, fee: damageFee } : null
          });
        } catch (err) {
          db.run('ROLLBACK');
          reject(err);
        }
      });
    });
  }

  static async rollbackRecord(recordId, operator) {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT br.*, e.current_booth_id as current_booth 
         FROM borrow_records br 
         JOIN equipments e ON br.equipment_id = e.id 
         WHERE br.id = ?`,
        [recordId],
        async (err, record) => {
          if (err) {
            reject(err);
            return;
          }
          
          if (!record) {
            await this.logOperation(null, 'rollback', 'rejected', '记录不存在', operator);
            resolve({ success: false, reason: '记录不存在', code: 'RECORD_NOT_FOUND' });
            return;
          }

          if (record.status === 'rolled_back') {
            await this.logOperation(recordId, 'rollback', 'rejected', '记录已回滚', operator);
            resolve({ success: false, reason: '记录已回滚', code: 'ALREADY_ROLLED_BACK' });
            return;
          }

          db.serialize(async () => {
            try {
              db.run('BEGIN TRANSACTION');

              db.run(
                'UPDATE borrow_records SET status = ? WHERE id = ?',
                ['rolled_back', recordId]
              );

              db.run(
                'UPDATE equipments SET current_booth_id = ?, status = ? WHERE id = ?',
                [record.from_booth_id, 'available', record.equipment_id]
              );

              await this.logOperation(recordId, 'rollback', 'approved', '操作已回滚', operator);

              db.run('COMMIT');

              resolve({
                success: true,
                reason: '操作已回滚',
                recordId
              });
            } catch (err) {
              db.run('ROLLBACK');
              reject(err);
            }
          });
        }
      );
    });
  }

  static async queryRecords(filters = {}) {
    let sql = `
      SELECT 
        br.id,
        br.operation_type,
        br.status,
        br.remark,
        br.damage_level,
        br.damage_fee,
        br.created_at,
        br.operator,
        e.barcode,
        e.name as equipment_name,
        e.type as equipment_type,
        fb.name as from_booth,
        tb.name as to_booth,
        ol.reason as operation_reason
      FROM borrow_records br
      JOIN equipments e ON br.equipment_id = e.id
      LEFT JOIN booths fb ON br.from_booth_id = fb.id
      JOIN booths tb ON br.to_booth_id = tb.id
      LEFT JOIN operation_logs ol ON br.id = ol.record_id
      WHERE 1=1
    `;
    
    const params = [];

    if (filters.operator) {
      sql += ' AND br.operator LIKE ?';
      params.push(`%${filters.operator}%`);
    }

    if (filters.status) {
      sql += ' AND br.status = ?';
      params.push(filters.status);
    }

    if (filters.operationType) {
      sql += ' AND br.operation_type = ?';
      params.push(filters.operationType);
    }

    if (filters.startDate) {
      sql += ' AND br.created_at >= ?';
      params.push(filters.startDate);
    }

    if (filters.endDate) {
      sql += ' AND br.created_at <= ?';
      params.push(filters.endDate);
    }

    if (filters.hasDamage) {
      sql += ' AND br.damage_level IS NOT NULL';
    }

    sql += ' ORDER BY br.created_at DESC';

    return new Promise((resolve, reject) => {
      db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  static async getOperationLogs() {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT * FROM operation_logs ORDER BY created_at DESC LIMIT 100`,
        [],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
  }

  static async getAllEquipments() {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT e.*, b.name as booth_name FROM equipments e 
         LEFT JOIN booths b ON e.current_booth_id = b.id 
         ORDER BY e.created_at DESC`,
        [],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
  }

  static async getAllBooths() {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT * FROM booths ORDER BY name`,
        [],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
  }

  static async getStatistics() {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT 
          (SELECT COUNT(*) FROM equipments WHERE status = 'available') as available,
          (SELECT COUNT(*) FROM equipments WHERE status = 'in_use') as in_use,
          (SELECT COUNT(*) FROM equipments WHERE status = 'damaged') as damaged,
          (SELECT COUNT(*) FROM borrow_records WHERE status = 'confirmed') as total_transactions,
          (SELECT COUNT(*) FROM borrow_records WHERE damage_level IS NOT NULL) as damaged_records,
          (SELECT SUM(damage_fee) FROM borrow_records WHERE damage_fee > 0) as total_damage_fee
        FROM equipments LIMIT 1`,
        [],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });
  }
}

module.exports = EquipmentService;
