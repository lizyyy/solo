const db = require('../db/database');
const dayjs = require('dayjs');
const { getStatusText, getOverdueInfo, getSmsWarningInfo, maskPackageData } = require('../utils/privacy');

class PackageService {
  static create(data) {
    const stmt = db.prepare(`
      INSERT INTO packages (
        batch_id, pick_up_code, tracking_no, receiver_name, receiver_phone,
        receiver_address, arrived_at, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      data.batch_id || null,
      data.pick_up_code,
      data.tracking_no || '',
      data.receiver_name,
      data.receiver_phone,
      data.receiver_address || '',
      data.arrived_at || dayjs().format('YYYY-MM-DD HH:mm:ss'),
      data.status || 'pending'
    );
    return this.getById(result.lastInsertRowid);
  }

  static getById(id) {
    return db.prepare('SELECT * FROM packages WHERE id = ?').get(id);
  }

  static getByPickUpCode(code, masked = false) {
    const pkg = db.prepare('SELECT * FROM packages WHERE pick_up_code = ?').get(code);
    return masked ? maskPackageData(pkg) : pkg;
  }

  static search(params = {}) {
    let sql = 'SELECT * FROM packages WHERE 1=1';
    const countSql = 'SELECT COUNT(*) as total FROM packages WHERE 1=1';
    const conditions = [];
    const values = [];

    if (params.pick_up_code) {
      conditions.push('pick_up_code LIKE ?');
      values.push(`%${params.pick_up_code}%`);
    }
    if (params.receiver_name) {
      conditions.push('receiver_name LIKE ?');
      values.push(`%${params.receiver_name}%`);
    }
    if (params.return_batch_id) {
      conditions.push('return_batch_id = ?');
      values.push(params.return_batch_id);
    }
    if (params.status) {
      conditions.push('status = ?');
      values.push(params.status);
    }
    if (params.batch_id) {
      conditions.push('batch_id = ?');
      values.push(params.batch_id);
    }

    const where = conditions.length ? ' AND ' + conditions.join(' AND ') : '';
    const order = ' ORDER BY created_at DESC';
    const limit = params.limit ? ' LIMIT ?' : '';
    const offset = params.offset ? ' OFFSET ?' : '';

    if (limit) values.push(params.limit);
    if (offset) values.push(params.offset);

    const list = db.prepare(sql + where + order + limit + offset).all(...values);
    const total = db.prepare(countSql + where).get(...values.slice(0, conditions.length)).total;

    return { list, total };
  }

  static markProcessed(id, operator, action, reason) {
    const pkg = this.getById(id);
    if (!pkg) throw new Error('包裹不存在');

    let status = pkg.status;
    let updateFields = [];
    let updateValues = [];

    if (action === 'pick') {
      status = 'picked';
      updateFields.push('processed_at = ?');
      updateValues.push(dayjs().format('YYYY-MM-DD HH:mm:ss'));
    } else if (action === 'return') {
      status = 'returned';
      updateFields.push('returned_at = ?');
      updateValues.push(dayjs().format('YYYY-MM-DD HH:mm:ss'));
      updateFields.push('return_reason = ?');
      updateValues.push(reason || '');
    } else if (action === 'returning') {
      status = 'returning';
    }

    updateFields.push('status = ?');
    updateValues.push(status);
    updateFields.push('processed_by = ?');
    updateValues.push(operator || 'system');
    updateValues.push(id);

    db.prepare(`UPDATE packages SET ${updateFields.join(', ')} WHERE id = ?`).run(...updateValues);

    db.prepare(`
      INSERT INTO audit_logs (package_id, action, reason, operator, detail)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, action, reason, operator || 'system', JSON.stringify({ old_status: pkg.status, new_status: status }));

    return this.getById(id);
  }

  static updateReturn(id, data, operator) {
    const pkg = this.getById(id);
    if (!pkg) throw new Error('包裹不存在');

    const fields = [];
    const values = [];

    if (data.return_reason !== undefined) {
      fields.push('return_reason = ?');
      values.push(data.return_reason);
    }
    if (data.return_batch_id !== undefined) {
      fields.push('return_batch_id = ?');
      values.push(data.return_batch_id);
    }
    if (data.status !== undefined) {
      fields.push('status = ?');
      values.push(data.status);
    }

    if (fields.length === 0) return pkg;

    values.push(id);
    db.prepare(`UPDATE packages SET ${fields.join(', ')} WHERE id = ?`).run(...values);

    db.prepare(`
      INSERT INTO audit_logs (package_id, action, reason, operator, detail)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, 'return_update', data.return_reason || pkg.return_reason, operator || 'system', JSON.stringify(data));

    return this.getById(id);
  }

  static addSmsRecord(packageId, phone, content, sentAt) {
    const pkg = this.getById(packageId);
    if (!pkg) throw new Error('包裹不存在');

    db.prepare(`
      INSERT INTO sms_records (package_id, phone, content, sent_at)
      VALUES (?, ?, ?, ?)
    `).run(packageId, phone, content, sentAt || dayjs().format('YYYY-MM-DD HH:mm:ss'));

    const newCount = pkg.sms_count + 1;
    db.prepare('UPDATE packages SET sms_count = ?, last_sms_at = ? WHERE id = ?').run(
      newCount,
      sentAt || dayjs().format('YYYY-MM-DD HH:mm:ss'),
      packageId
    );

    db.prepare(`
      INSERT INTO audit_logs (package_id, action, reason, operator, detail)
      VALUES (?, ?, ?, ?, ?)
    `).run(packageId, 'sms_sent', `第${newCount}次催取`, 'system', content);

    return { ...pkg, sms_count: newCount };
  }

  static getSmsRecords(packageId) {
    return db.prepare('SELECT * FROM sms_records WHERE package_id = ? ORDER BY sent_at DESC').all(packageId);
  }

  static getAuditLogs(packageId) {
    return db.prepare('SELECT * FROM audit_logs WHERE package_id = ? ORDER BY created_at DESC').all(packageId);
  }

  static enrichWithDetails(pkg, rule) {
    if (!pkg) return null;
    const overdue = getOverdueInfo(pkg, rule);
    const sms = getSmsWarningInfo(pkg, rule);
    return {
      ...pkg,
      status_text: getStatusText(pkg.status),
      overdue_info: overdue,
      sms_info: sms,
      decision_note: this.buildDecisionNote(pkg, overdue, sms)
    };
  }

  static buildDecisionNote(pkg, overdue, sms) {
    const notes = [];
    if (pkg.status === 'picked') {
      notes.push(`已放行：用户于${pkg.processed_at}取件，处理人：${pkg.processed_by}`);
    } else if (pkg.status === 'returned' || pkg.status === 'returning') {
      if (pkg.return_reason) notes.push(`退回原因：${pkg.return_reason}`);
      if (overdue?.is_overdue) notes.push(overdue.description);
      if (sms?.is_sms_maxed) notes.push(sms.description);
      if (pkg.processed_by) notes.push(`处理人：${pkg.processed_by}`);
    } else {
      if (overdue) notes.push(overdue.description);
      if (sms) notes.push(sms.description);
    }
    return notes.join('；');
  }

  static getReturnRule() {
    return db.prepare('SELECT * FROM return_rules WHERE is_active = 1 ORDER BY id DESC LIMIT 1').get();
  }
}

module.exports = PackageService;
