const db = require('../utils/database');
const { HAZARD_STATUS } = require('../utils/constants');
const { validateHazard } = require('../utils/validator');

class HazardModel {
  async create(data) {
    const validation = validateHazard(data);
    if (!validation.isValid) {
      throw new Error(`数据验证失败: ${JSON.stringify(validation.errors)}`);
    }

    const { value } = validation;
    
    const result = await db.run(`
      INSERT INTO hazards (
        hazard_code, title, description, location, level,
        discover_date, discoverer, department, responsible_person,
        deadline, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      value.hazardCode,
      value.title,
      value.description || '',
      value.location,
      value.level,
      value.discoverDate.toISOString().split('T')[0],
      value.discoverer,
      value.department || '',
      value.responsiblePerson || '',
      value.deadline ? value.deadline.toISOString().split('T')[0] : null,
      value.status || HAZARD_STATUS.NEW
    ]);

    return { id: result.lastID, hazardCode: value.hazardCode };
  }

  async findByCode(hazardCode) {
    return await db.get('SELECT * FROM hazards WHERE hazard_code = ?', [hazardCode]);
  }

  async findAll(filters = {}) {
    let sql = 'SELECT * FROM hazards WHERE 1=1';
    const params = [];

    if (filters.status) {
      sql += ' AND status = ?';
      params.push(filters.status);
    }
    if (filters.level) {
      sql += ' AND level = ?';
      params.push(filters.level);
    }
    if (filters.responsiblePerson) {
      sql += ' AND responsible_person = ?';
      params.push(filters.responsiblePerson);
    }

    sql += ' ORDER BY discover_date DESC, hazard_code DESC';
    return await db.all(sql, params);
  }

  async updateStatus(hazardCode, newStatus, operator, reason = '') {
    const hazard = await this.findByCode(hazardCode);
    if (!hazard) {
      throw new Error(`隐患不存在: ${hazardCode}`);
    }

    const oldStatus = hazard.status;

    await db.run(`
      UPDATE hazards 
      SET status = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE hazard_code = ?
    `, [newStatus, hazardCode]);

    await db.run(`
      INSERT INTO status_history (hazard_code, from_status, to_status, operator, reason)
      VALUES (?, ?, ?, ?, ?)
    `, [hazardCode, oldStatus, newStatus, operator, reason]);

    return { hazardCode, oldStatus, newStatus };
  }

  async assignResponsible(hazardCode, responsiblePerson, deadline, operator) {
    const hazard = await this.findByCode(hazardCode);
    if (!hazard) {
      throw new Error(`隐患不存在: ${hazardCode}`);
    }

    await db.run(`
      UPDATE hazards 
      SET responsible_person = ?, deadline = ?, status = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE hazard_code = ?
    `, [
      responsiblePerson,
      deadline ? deadline.toISOString().split('T')[0] : null,
      HAZARD_STATUS.ASSIGNED,
      hazardCode
    ]);

    await db.run(`
      INSERT INTO status_history (hazard_code, from_status, to_status, operator, reason)
      VALUES (?, ?, ?, ?, ?)
    `, [hazardCode, hazard.status, HAZARD_STATUS.ASSIGNED, operator, '分配整改责任人']);

    return true;
  }

  async startRectification(hazardCode, description, operator) {
    const hazard = await this.findByCode(hazardCode);
    if (!hazard) {
      throw new Error(`隐患不存在: ${hazardCode}`);
    }

    await db.run(`
      UPDATE hazards 
      SET rectification_description = ?, rectification_date = CURRENT_DATE, 
          status = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE hazard_code = ?
    `, [description, HAZARD_STATUS.RECTIFYING, hazardCode]);

    await db.run(`
      INSERT INTO status_history (hazard_code, from_status, to_status, operator, reason)
      VALUES (?, ?, ?, ?, ?)
    `, [hazardCode, hazard.status, HAZARD_STATUS.RECTIFYING, operator, '开始整改']);

    return true;
  }

  async completeRectification(hazardCode, operator) {
    const hazard = await this.findByCode(hazardCode);
    if (!hazard) {
      throw new Error(`隐患不存在: ${hazardCode}`);
    }

    await db.run(`
      UPDATE hazards 
      SET rectification_complete_date = CURRENT_DATE, 
          status = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE hazard_code = ?
    `, [HAZARD_STATUS.REVIEWING, hazardCode]);

    await db.run(`
      INSERT INTO status_history (hazard_code, from_status, to_status, operator, reason)
      VALUES (?, ?, ?, ?, ?)
    `, [hazardCode, hazard.status, HAZARD_STATUS.REVIEWING, operator, '整改完成，申请复查']);

    return true;
  }

  async review(hazardCode, result, reviewer, comments = '') {
    const hazard = await this.findByCode(hazardCode);
    if (!hazard) {
      throw new Error(`隐患不存在: ${hazardCode}`);
    }

    const newStatus = result === 'pass' ? HAZARD_STATUS.CLOSED : HAZARD_STATUS.REJECTED;

    await db.run(`
      UPDATE hazards 
      SET review_result = ?, review_date = CURRENT_DATE, reviewer = ?, 
          review_comments = ?, status = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE hazard_code = ?
    `, [result, reviewer, comments, newStatus, hazardCode]);

    await db.run(`
      INSERT INTO status_history (hazard_code, from_status, to_status, operator, reason)
      VALUES (?, ?, ?, ?, ?)
    `, [hazardCode, hazard.status, newStatus, reviewer, `复查${result === 'pass' ? '通过' : '不通过'}`]);

    return { hazardCode, result, newStatus };
  }

  async getStatistics() {
    const total = await db.get('SELECT COUNT(*) as count FROM hazards');
    const byStatus = await db.all('SELECT status, COUNT(*) as count FROM hazards GROUP BY status');
    const byLevel = await db.all('SELECT level, COUNT(*) as count FROM hazards GROUP BY level');
    
    const closed = await db.get(`
      SELECT COUNT(*) as count FROM hazards 
      WHERE status = ?
    `, [HAZARD_STATUS.CLOSED]);

    const overdue = await db.get(`
      SELECT COUNT(*) as count FROM hazards 
      WHERE status != ? AND deadline IS NOT NULL AND deadline < CURRENT_DATE
    `, [HAZARD_STATUS.CLOSED]);

    return {
      total: total.count,
      closed: closed.count,
      pending: total.count - closed.count,
      overdue: overdue.count,
      byStatus: byStatus.reduce((acc, item) => ({ ...acc, [item.status]: item.count }), {}),
      byLevel: byLevel.reduce((acc, item) => ({ ...acc, [item.level]: item.count }), {}),
      closureRate: total.count > 0 ? Math.round((closed.count / total.count) * 100) : 0
    };
  }

  async getStatusHistory(hazardCode) {
    return await db.all(`
      SELECT * FROM status_history 
      WHERE hazard_code = ? 
      ORDER BY created_at ASC
    `, [hazardCode]);
  }
}

HazardModel.prototype.run = function(sql, params = []) {
  return db.run(sql, params);
};

module.exports = new HazardModel();
