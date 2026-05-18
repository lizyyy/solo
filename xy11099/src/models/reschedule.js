const db = require('./database');

const STATUS_FLOW = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['completed', 'cancelled'],
  completed: ['reversed'],
  cancelled: [],
  reversed: []
};

class Reschedule {
  generateRescheduleNo() {
    const date = new Date();
    const timestamp = date.getTime().toString().slice(-6);
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `RS${date.getFullYear()}${(date.getMonth() + 1).toString().padStart(2, '0')}${timestamp}${random}`;
  }

  validateStatusTransition(currentStatus, newStatus) {
    const allowedTransitions = STATUS_FLOW[currentStatus] || [];
    return allowedTransitions.includes(newStatus);
  }

  async create(data) {
    const now = new Date().toISOString();
    const rescheduleNo = data.reschedule_no || this.generateRescheduleNo();
    
    const sql = `INSERT INTO reschedules (
      reschedule_no, customer_name, customer_phone, original_shot_date,
      new_shot_date, original_route, new_route, scenic_spot, store,
      person_in_charge, reschedule_reason, status, reschedule_fee,
      remarks, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    const params = [
      rescheduleNo, data.customer_name, data.customer_phone,
      data.original_shot_date, data.new_shot_date, data.original_route,
      data.new_route, data.scenic_spot, data.store, data.person_in_charge,
      data.reschedule_reason, data.status || 'pending',
      data.reschedule_fee || 0, data.remarks || '', now, now
    ];

    const result = await db.run(sql, params);
    const reschedule = await this.getById(result.id);
    
    await this.addHistory(result.id, 'create', null, JSON.stringify(reschedule), data.operator || 'system');
    
    return reschedule;
  }

  async getById(id) {
    const sql = 'SELECT * FROM reschedules WHERE id = ?';
    return await db.get(sql, [id]);
  }

  async getByRescheduleNo(rescheduleNo) {
    const sql = 'SELECT * FROM reschedules WHERE reschedule_no = ?';
    return await db.get(sql, [rescheduleNo]);
  }

  async list(filters = {}) {
    let sql = 'SELECT * FROM reschedules WHERE 1=1';
    const params = [];

    if (filters.status) {
      sql += ' AND status = ?';
      params.push(filters.status);
    }
    if (filters.store) {
      sql += ' AND store = ?';
      params.push(filters.store);
    }
    if (filters.person_in_charge) {
      sql += ' AND person_in_charge = ?';
      params.push(filters.person_in_charge);
    }
    if (filters.scenic_spot) {
      sql += ' AND scenic_spot = ?';
      params.push(filters.scenic_spot);
    }
    if (filters.start_date) {
      sql += ' AND new_shot_date >= ?';
      params.push(filters.start_date);
    }
    if (filters.end_date) {
      sql += ' AND new_shot_date <= ?';
      params.push(filters.end_date);
    }
    if (filters.customer_name) {
      sql += ' AND customer_name LIKE ?';
      params.push(`%${filters.customer_name}%`);
    }

    sql += ' ORDER BY created_at DESC';

    return await db.all(sql, params);
  }

  async update(id, data, operator = 'system') {
    const existing = await this.getById(id);
    if (!existing) {
      throw new Error('改期记录不存在');
    }

    if (data.status && data.status !== existing.status) {
      if (!this.validateStatusTransition(existing.status, data.status)) {
        throw new Error(`无效的状态转换: ${existing.status} -> ${data.status}`);
      }
    }

    const now = new Date().toISOString();
    const updates = [];
    const params = [];

    const allowedFields = [
      'customer_name', 'customer_phone', 'original_shot_date',
      'new_shot_date', 'original_route', 'new_route', 'scenic_spot',
      'store', 'person_in_charge', 'reschedule_reason', 'status',
      'reschedule_fee', 'remarks'
    ];

    allowedFields.forEach(field => {
      if (data[field] !== undefined) {
        updates.push(`${field} = ?`);
        params.push(data[field]);
      }
    });

    if (updates.length === 0) {
      return existing;
    }

    updates.push('updated_at = ?');
    params.push(now);
    params.push(id);

    const sql = `UPDATE reschedules SET ${updates.join(', ')} WHERE id = ?`;
    await db.run(sql, params);

    const updated = await this.getById(id);
    await this.addHistory(id, 'update', JSON.stringify(existing), JSON.stringify(updated), operator);

    return updated;
  }

  async reverse(id, operator = 'system', reverseReason = '') {
    const existing = await this.getById(id);
    if (!existing) {
      throw new Error('改期记录不存在');
    }

    if (existing.status !== 'completed') {
      throw new Error('只有已完成的记录才能冲正');
    }

    if (existing.is_reversed) {
      throw new Error('该记录已被冲正');
    }

    const now = new Date().toISOString();

    await db.run(
      'UPDATE reschedules SET is_reversed = 1, updated_at = ? WHERE id = ?',
      [now, id]
    );

    const reversedRecord = await this.create({
      customer_name: existing.customer_name,
      customer_phone: existing.customer_phone,
      original_shot_date: existing.new_shot_date,
      new_shot_date: existing.original_shot_date,
      original_route: existing.new_route,
      new_route: existing.original_route,
      scenic_spot: existing.scenic_spot,
      store: existing.store,
      person_in_charge: existing.person_in_charge,
      reschedule_reason: `冲正: ${existing.reschedule_no}, 原因: ${reverseReason}`,
      status: 'pending',
      reschedule_fee: -existing.reschedule_fee,
      remarks: `冲正记录，原单号: ${existing.reschedule_no}`,
      operator
    });

    await db.run(
      'UPDATE reschedules SET reversed_from = ? WHERE id = ?',
      [reversedRecord.id, id]
    );

    await this.addHistory(id, 'reverse', JSON.stringify(existing), JSON.stringify(reversedRecord), operator);

    return { original: await this.getById(id), reversed: reversedRecord };
  }

  async addHistory(rescheduleId, action, oldData, newData, operator) {
    const now = new Date().toISOString();
    const sql = `INSERT INTO reschedule_history (
      reschedule_id, action, old_data, new_data, operator, operated_at
    ) VALUES (?, ?, ?, ?, ?, ?)`;
    return await db.run(sql, [rescheduleId, action, oldData, newData, operator, now]);
  }

  async getHistory(id) {
    const sql = 'SELECT * FROM reschedule_history WHERE reschedule_id = ? ORDER BY operated_at DESC';
    return await db.all(sql, [id]);
  }

  async batchImport(records, operator = 'system') {
    const results = {
      success: [],
      failed: [],
      total: records.length
    };

    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      try {
        const requiredFields = [
          'customer_name', 'customer_phone', 'original_shot_date',
          'new_shot_date', 'original_route', 'new_route', 'scenic_spot',
          'store', 'person_in_charge', 'reschedule_reason'
        ];

        const missingFields = requiredFields.filter(field => !record[field]);
        if (missingFields.length > 0) {
          throw new Error(`缺少必填字段: ${missingFields.join(', ')}`);
        }

        const created = await this.create({ ...record, operator });
        results.success.push({ rowIndex: i, data: created });
      } catch (error) {
        results.failed.push({
          rowIndex: i,
          data: record,
          error: error.message
        });
      }
    }

    return results;
  }
}

module.exports = new Reschedule();