const { v4: uuidv4 } = require('uuid');
const { run, get, all, OrderFreezeStatus } = require('./database');

class OrderFreeze {
  static async create(data) {
    const now = Date.now();
    const id = uuidv4();
    
    await run(`
      INSERT INTO order_freezes (
        id, order_no, risk_reason, freeze_action, freeze_action_details,
        release_condition, status, original_input, processing_basis,
        created_at, updated_at, frozen_at, version
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `, [
      id,
      data.orderNo,
      data.riskReason,
      data.freezeAction,
      data.freezeActionDetails || null,
      data.releaseCondition || null,
      OrderFreezeStatus.FROZEN,
      JSON.stringify(data.originalInput || data),
      data.processingBasis || null,
      now,
      now,
      now
    ]);

    return await this.findById(id);
  }

  static async findById(id) {
    return get('SELECT * FROM order_freezes WHERE id = ?', [id]);
  }

  static async findByOrderNo(orderNo) {
    return all('SELECT * FROM order_freezes WHERE order_no = ? ORDER BY created_at DESC', [orderNo]);
  }

  static async findActiveByOrderNo(orderNo) {
    return all(`
      SELECT * FROM order_freezes 
      WHERE order_no = ? AND status IN ('FROZEN', 'UNDER_REVIEW')
      ORDER BY created_at DESC
    `, [orderNo]);
  }

  static async findAll(filters = {}, pagination = {}) {
    let sql = 'SELECT * FROM order_freezes WHERE 1=1';
    const params = [];

    if (filters.status) {
      sql += ' AND status = ?';
      params.push(filters.status);
    }

    if (filters.orderNo) {
      sql += ' AND order_no LIKE ?';
      params.push(`%${filters.orderNo}%`);
    }

    if (filters.reviewer) {
      sql += ' AND reviewer = ?';
      params.push(filters.reviewer);
    }

    if (filters.startTime) {
      sql += ' AND created_at >= ?';
      params.push(filters.startTime);
    }

    if (filters.endTime) {
      sql += ' AND created_at <= ?';
      params.push(filters.endTime);
    }

    sql += ' ORDER BY created_at DESC';

    if (pagination.limit) {
      sql += ' LIMIT ?';
      params.push(pagination.limit);
    }

    if (pagination.offset) {
      sql += ' OFFSET ?';
      params.push(pagination.offset);
    }

    return all(sql, params);
  }

  static async count(filters = {}) {
    let sql = 'SELECT COUNT(*) as total FROM order_freezes WHERE 1=1';
    const params = [];

    if (filters.status) {
      sql += ' AND status = ?';
      params.push(filters.status);
    }

    if (filters.orderNo) {
      sql += ' AND order_no LIKE ?';
      params.push(`%${filters.orderNo}%`);
    }

    const result = await get(sql, params);
    return result.total;
  }

  static async updateStatus(id, status, data = {}) {
    const now = Date.now();
    const freeze = await this.findById(id);
    if (!freeze) return null;

    let updateFields = ['status = ?', 'updated_at = ?', 'version = version + 1'];
    let params = [status, now];

    if (status === OrderFreezeStatus.UNDER_REVIEW) {
      updateFields.push('reviewer = ?');
      params.push(data.reviewer);
    }

    if (status === OrderFreezeStatus.RELEASED) {
      updateFields.push('released_at = ?');
      updateFields.push('final_conclusion = ?');
      params.push(now);
      params.push(data.finalConclusion || '已释放');
    }

    if (status === OrderFreezeStatus.CANCELLED) {
      updateFields.push('cancelled_at = ?');
      updateFields.push('final_conclusion = ?');
      params.push(now);
      params.push(data.finalConclusion || '已取消');
    }

    if (data.processingSummary) {
      updateFields.push('processing_summary = ?');
      params.push(data.processingSummary);
    }

    params.push(id);

    await run(`
      UPDATE order_freezes 
      SET ${updateFields.join(', ')}
      WHERE id = ?
    `, params);

    return this.findById(id);
  }

  static async manualCorrect(id, correctionData) {
    const now = Date.now();
    const freeze = await this.findById(id);
    if (!freeze) return null;

    await run(`
      UPDATE order_freezes 
      SET risk_reason = ?,
          freeze_action = ?,
          freeze_action_details = ?,
          release_condition = ?,
          processing_summary = ?,
          status = ?,
          updated_at = ?,
          version = version + 1
      WHERE id = ?
    `, [
      correctionData.riskReason || freeze.risk_reason,
      correctionData.freezeAction || freeze.freeze_action,
      correctionData.freezeActionDetails || freeze.freeze_action_details,
      correctionData.releaseCondition || freeze.release_condition,
      correctionData.processingSummary || freeze.processing_summary,
      OrderFreezeStatus.MANUALLY_CORRECTED,
      now,
      id
    ]);

    return this.findById(id);
  }

  static async addProcessingSummary(id, summary) {
    const now = Date.now();
    const current = await this.findById(id);
    const newSummary = (current.processing_summary || '') + 
      `[${new Date(now).toISOString()}] ${summary}\n`;
    
    await run(`
      UPDATE order_freezes 
      SET processing_summary = ?,
          updated_at = ?
      WHERE id = ?
    `, [newSummary, now, id]);

    return this.findById(id);
  }
}

module.exports = OrderFreeze;
