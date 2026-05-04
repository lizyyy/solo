const { v4: uuidv4 } = require('uuid');
const { runAsync, getAsync, allAsync } = require('../database');

class PlanRepository {
  async create(planData) {
    const now = new Date().toISOString();
    const id = planData.id || uuidv4();
    const date = planData.date || new Date().toISOString().split('T')[0];
    
    await runAsync(`
      INSERT INTO plans (
        id, name, description, date, strategy,
        plan_data, is_active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id,
      planData.name || `方案 ${date}`,
      planData.description || '',
      date,
      planData.strategy || 'greedy',
      JSON.stringify(planData.planData || planData),
      planData.isActive ? 1 : 0,
      now,
      now
    ]);
    
    await this.createVersion(id, 1, planData.planData || planData, '初始版本');
    
    return this.findById(id);
  }

  async update(id, planData) {
    const existing = await this.findById(id);
    if (!existing) {
      throw new Error(`方案 ${id} 不存在`);
    }
    
    const now = new Date().toISOString();
    
    const latestVersion = await this.getLatestVersion(id);
    const newVersionNumber = (latestVersion?.version_number || 0) + 1;
    
    await this.createVersion(
      id, 
      newVersionNumber, 
      planData.planData || planData,
      planData.changeLog || '更新方案'
    );
    
    await runAsync(`
      UPDATE plans SET
        name = ?, description = ?, date = ?, strategy = ?,
        plan_data = ?, is_active = ?, updated_at = ?
      WHERE id = ?
    `, [
      planData.name || existing.name,
      planData.description || existing.description,
      planData.date || existing.date,
      planData.strategy || existing.strategy,
      JSON.stringify(planData.planData || planData),
      planData.isActive !== undefined ? (planData.isActive ? 1 : 0) : existing.is_active,
      now,
      id
    ]);
    
    return this.findById(id);
  }

  async delete(id) {
    await runAsync('DELETE FROM plan_versions WHERE plan_id = ?', [id]);
    const result = await runAsync('DELETE FROM plans WHERE id = ?', [id]);
    return result.changes > 0;
  }

  async findById(id) {
    const row = await getAsync('SELECT * FROM plans WHERE id = ?', [id]);
    if (!row) return null;
    return this.rowToModel(row);
  }

  async findAll(options = {}) {
    const { date, isActive, limit, offset } = options;
    let sql = 'SELECT * FROM plans WHERE 1=1';
    const params = [];
    
    if (date) {
      sql += ' AND date = ?';
      params.push(date);
    }
    if (isActive !== undefined) {
      sql += ' AND is_active = ?';
      params.push(isActive ? 1 : 0);
    }
    
    sql += ' ORDER BY created_at DESC';
    
    if (limit) {
      sql += ' LIMIT ?';
      params.push(limit);
    }
    if (offset) {
      sql += ' OFFSET ?';
      params.push(offset);
    }
    
    const rows = await allAsync(sql, params);
    return rows.map(row => this.rowToModel(row));
  }

  async count(options = {}) {
    const { date, isActive } = options;
    let sql = 'SELECT COUNT(*) as count FROM plans WHERE 1=1';
    const params = [];
    
    if (date) {
      sql += ' AND date = ?';
      params.push(date);
    }
    if (isActive !== undefined) {
      sql += ' AND is_active = ?';
      params.push(isActive ? 1 : 0);
    }
    
    const result = await getAsync(sql, params);
    return result.count;
  }

  async setActive(id) {
    await runAsync('UPDATE plans SET is_active = 0 WHERE is_active = 1');
    const result = await runAsync('UPDATE plans SET is_active = 1 WHERE id = ?', [id]);
    return result.changes > 0;
  }

  async getActive() {
    const row = await getAsync('SELECT * FROM plans WHERE is_active = 1 LIMIT 1');
    if (!row) return null;
    return this.rowToModel(row);
  }

  async createVersion(planId, versionNumber, planData, changeLog = '') {
    const id = uuidv4();
    const now = new Date().toISOString();
    
    await runAsync(`
      INSERT INTO plan_versions (
        id, plan_id, version_number, plan_data, change_log, created_at
      ) VALUES (?, ?, ?, ?, ?, ?)
    `, [id, planId, versionNumber, JSON.stringify(planData), changeLog, now]);
    
    return id;
  }

  async getVersions(planId) {
    const rows = await allAsync(
      'SELECT * FROM plan_versions WHERE plan_id = ? ORDER BY version_number DESC',
      [planId]
    );
    return rows.map(row => ({
      id: row.id,
      planId: row.plan_id,
      versionNumber: row.version_number,
      planData: JSON.parse(row.plan_data),
      changeLog: row.change_log,
      createdAt: row.created_at
    }));
  }

  async getLatestVersion(planId) {
    const row = await getAsync(
      'SELECT * FROM plan_versions WHERE plan_id = ? ORDER BY version_number DESC LIMIT 1',
      [planId]
    );
    if (!row) return null;
    return {
      id: row.id,
      planId: row.plan_id,
      versionNumber: row.version_number,
      planData: JSON.parse(row.plan_data),
      changeLog: row.change_log,
      createdAt: row.created_at
    };
  }

  async getVersion(planId, versionNumber) {
    const row = await getAsync(
      'SELECT * FROM plan_versions WHERE plan_id = ? AND version_number = ?',
      [planId, versionNumber]
    );
    if (!row) return null;
    return {
      id: row.id,
      planId: row.plan_id,
      versionNumber: row.version_number,
      planData: JSON.parse(row.plan_data),
      changeLog: row.change_log,
      createdAt: row.created_at
    };
  }

  rowToModel(row) {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      date: row.date,
      strategy: row.strategy,
      planData: JSON.parse(row.plan_data),
      isActive: row.is_active === 1,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}

module.exports = new PlanRepository();
