const db = require('./database');
const stateMachine = require('./stateMachine');

const models = {};

models.packages = {
  create: function(packageData) {
    const database = db.getDatabase();
    const now = db.getCurrentTime();
    const id = db.generateId();
    
    const stmt = database.prepare(`
      INSERT INTO instrument_packages (
        id, package_number, name, description, instruments,
        current_status, expiration_date, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      id,
      packageData.package_number,
      packageData.name,
      packageData.description || null,
      packageData.instruments ? JSON.stringify(packageData.instruments) : null,
      stateMachine.STATUS.PENDING_CLEANING,
      packageData.expiration_date || null,
      now,
      now
    );
    
    return this.getById(id);
  },

  getById: function(id) {
    const database = db.getDatabase();
    const stmt = database.prepare('SELECT * FROM instrument_packages WHERE id = ?');
    const result = stmt.get(id);
    
    if (result) {
      result.instruments = result.instruments ? JSON.parse(result.instruments) : null;
    }
    return result;
  },

  getByNumber: function(packageNumber) {
    const database = db.getDatabase();
    const stmt = database.prepare('SELECT * FROM instrument_packages WHERE package_number = ?');
    const result = stmt.get(packageNumber);
    
    if (result) {
      result.instruments = result.instruments ? JSON.parse(result.instruments) : null;
    }
    return result;
  },

  getAll: function(filters = {}) {
    const database = db.getDatabase();
    let sql = 'SELECT * FROM instrument_packages WHERE 1=1';
    const params = [];

    if (filters.status) {
      sql += ' AND current_status = ?';
      params.push(filters.status);
    }
    if (filters.package_number) {
      sql += ' AND package_number LIKE ?';
      params.push(`%${filters.package_number}%`);
    }

    sql += ' ORDER BY created_at DESC';
    
    const stmt = database.prepare(sql);
    const results = stmt.all(...params);
    
    return results.map(r => ({
      ...r,
      instruments: r.instruments ? JSON.parse(r.instruments) : null
    }));
  },

  updateStatus: function(id, newStatus, additionalData = {}) {
    const database = db.getDatabase();
    const now = db.getCurrentTime();
    
    const updates = ['current_status = ?', 'updated_at = ?'];
    const values = [newStatus, now, id];

    if (additionalData.expiration_date) {
      updates.push('expiration_date = ?');
      values.splice(-1, 0, additionalData.expiration_date);
    }

    const stmt = database.prepare(`
      UPDATE instrument_packages SET ${updates.join(', ')} WHERE id = ?
    `);
    
    stmt.run(...values);
    return this.getById(id);
  },

  delete: function(id) {
    const database = db.getDatabase();
    const stmt = database.prepare('DELETE FROM instrument_packages WHERE id = ?');
    return stmt.run(id);
  }
};

models.cycles = {
  create: function(cycleData) {
    const database = db.getDatabase();
    const now = db.getCurrentTime();
    const id = db.generateId();
    
    const stmt = database.prepare(`
      INSERT INTO sterilization_cycles (
        id, cycle_number, sterilizer_id, cycle_type,
        start_time, end_time, status, target_temperature,
        target_duration, actual_temperature, actual_duration,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      id,
      cycleData.cycle_number,
      cycleData.sterilizer_id,
      cycleData.cycle_type,
      cycleData.start_time || now,
      cycleData.end_time || null,
      cycleData.status || 'IN_PROGRESS',
      cycleData.target_temperature,
      cycleData.target_duration,
      cycleData.actual_temperature || null,
      cycleData.actual_duration || null,
      now,
      now
    );
    
    return this.getById(id);
  },

  getById: function(id) {
    const database = db.getDatabase();
    const stmt = database.prepare('SELECT * FROM sterilization_cycles WHERE id = ?');
    return stmt.get(id);
  },

  getByNumber: function(cycleNumber) {
    const database = db.getDatabase();
    const stmt = database.prepare('SELECT * FROM sterilization_cycles WHERE cycle_number = ?');
    return stmt.get(cycleNumber);
  },

  getAll: function(filters = {}) {
    const database = db.getDatabase();
    let sql = 'SELECT * FROM sterilization_cycles WHERE 1=1';
    const params = [];

    if (filters.status) {
      sql += ' AND status = ?';
      params.push(filters.status);
    }
    if (filters.cycle_number) {
      sql += ' AND cycle_number LIKE ?';
      params.push(`%${filters.cycle_number}%`);
    }

    sql += ' ORDER BY created_at DESC';
    
    const stmt = database.prepare(sql);
    return stmt.all(...params);
  },

  update: function(id, updateData) {
    const database = db.getDatabase();
    const now = db.getCurrentTime();
    
    const updates = ['updated_at = ?'];
    const values = [now];

    const allowedFields = [
      'end_time', 'status', 'actual_temperature', 'actual_duration'
    ];

    for (const field of allowedFields) {
      if (updateData[field] !== undefined) {
        updates.push(`${field} = ?`);
        values.push(updateData[field]);
      }
    }

    values.push(id);

    const stmt = database.prepare(`
      UPDATE sterilization_cycles SET ${updates.join(', ')} WHERE id = ?
    `);
    
    stmt.run(...values);
    return this.getById(id);
  },

  complete: function(id, actualTemp, actualDuration, isQualified) {
    const database = db.getDatabase();
    const now = db.getCurrentTime();
    
    return this.update(id, {
      end_time: now,
      status: isQualified ? 'COMPLETED' : 'FAILED',
      actual_temperature: actualTemp,
      actual_duration: actualDuration
    });
  }
};

models.curves = {
  create: function(cycleId, curvePoint) {
    const database = db.getDatabase();
    const id = db.generateId();
    
    const stmt = database.prepare(`
      INSERT INTO parameter_curves (
        id, cycle_id, timestamp, temperature, pressure, humidity
      ) VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      id,
      cycleId,
      curvePoint.timestamp || db.getCurrentTime(),
      curvePoint.temperature,
      curvePoint.pressure || null,
      curvePoint.humidity || null
    );
    
    return this.getById(id);
  },

  getById: function(id) {
    const database = db.getDatabase();
    const stmt = database.prepare('SELECT * FROM parameter_curves WHERE id = ?');
    return stmt.get(id);
  },

  getByCycle: function(cycleId) {
    const database = db.getDatabase();
    const stmt = database.prepare(`
      SELECT * FROM parameter_curves 
      WHERE cycle_id = ? 
      ORDER BY timestamp ASC
    `);
    return stmt.all(cycleId);
  },

  batchCreate: function(cycleId, curvePoints) {
    return curvePoints.map(point => this.create(cycleId, point));
  },

  analyzeQuality: function(cycleId, targetTemp, tolerance = 2) {
    const curves = this.getByCycle(cycleId);
    
    if (curves.length === 0) {
      return { isQualified: false, reason: '无参数曲线数据' };
    }

    const minTemp = Math.min(...curves.map(c => c.temperature));
    const maxTemp = Math.max(...curves.map(c => c.temperature));
    
    const lowTemps = curves.filter(c => c.temperature < (targetTemp - tolerance));
    
    if (lowTemps.length > 0) {
      return {
        isQualified: false,
        reason: `存在${lowTemps.length}个点温度低于目标值±${tolerance}℃范围`,
        minTemp,
        maxTemp,
        targetTemp
      };
    }

    return {
      isQualified: true,
      reason: '所有温度点均在合格范围内',
      minTemp,
      maxTemp,
      targetTemp
    };
  }
};

models.qualityChecks = {
  create: function(checkData) {
    const database = db.getDatabase();
    const now = db.getCurrentTime();
    const id = db.generateId();
    
    const stmt = database.prepare(`
      INSERT INTO quality_checks (
        id, cycle_id, package_id, check_type, result,
        notes, checked_by, checked_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      id,
      checkData.cycle_id,
      checkData.package_id,
      checkData.check_type,
      checkData.result,
      checkData.notes || null,
      checkData.checked_by || null,
      checkData.checked_at || now
    );
    
    return this.getById(id);
  },

  getById: function(id) {
    const database = db.getDatabase();
    const stmt = database.prepare('SELECT * FROM quality_checks WHERE id = ?');
    return stmt.get(id);
  },

  getByPackage: function(packageId) {
    const database = db.getDatabase();
    const stmt = database.prepare(`
      SELECT * FROM quality_checks 
      WHERE package_id = ? 
      ORDER BY checked_at DESC
    `);
    return stmt.all(packageId);
  },

  getByCycle: function(cycleId) {
    const database = db.getDatabase();
    const stmt = database.prepare(`
      SELECT * FROM quality_checks 
      WHERE cycle_id = ? 
      ORDER BY checked_at DESC
    `);
    return stmt.all(cycleId);
  },

  hasPassedForPackage: function(packageId, cycleId) {
    const database = db.getDatabase();
    const stmt = database.prepare(`
      SELECT * FROM quality_checks 
      WHERE package_id = ? AND cycle_id = ? AND result = 'PASS'
      LIMIT 1
    `);
    return !!stmt.get(packageId, cycleId);
  }
};

models.usage = {
  create: function(usageData) {
    const database = db.getDatabase();
    const now = db.getCurrentTime();
    const id = db.generateId();
    
    const stmt = database.prepare(`
      INSERT INTO department_usage (
        id, package_id, department, user_name, usage_time, notes
      ) VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      id,
      usageData.package_id,
      usageData.department,
      usageData.user_name || null,
      usageData.usage_time || now,
      usageData.notes || null
    );
    
    return this.getById(id);
  },

  getById: function(id) {
    const database = db.getDatabase();
    const stmt = database.prepare('SELECT * FROM department_usage WHERE id = ?');
    return stmt.get(id);
  },

  getByPackage: function(packageId) {
    const database = db.getDatabase();
    const stmt = database.prepare(`
      SELECT * FROM department_usage 
      WHERE package_id = ? 
      ORDER BY usage_time DESC
    `);
    return stmt.all(packageId);
  },

  hasBeenUsed: function(packageId) {
    const database = db.getDatabase();
    const stmt = database.prepare(`
      SELECT id FROM department_usage WHERE package_id = ? LIMIT 1
    `);
    return !!stmt.get(packageId);
  }
};

models.audit = {
  log: function(action, entityType, entityId, details, performedBy) {
    const database = db.getDatabase();
    const now = db.getCurrentTime();
    const id = db.generateId();
    
    const stmt = database.prepare(`
      INSERT INTO audit_logs (
        id, action, entity_type, entity_id, details, performed_by, performed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      id,
      action,
      entityType,
      entityId,
      details ? JSON.stringify(details) : null,
      performedBy || null,
      now
    );
    
    return this.getById(id);
  },

  getById: function(id) {
    const database = db.getDatabase();
    const stmt = database.prepare('SELECT * FROM audit_logs WHERE id = ?');
    const result = stmt.get(id);
    if (result && result.details) {
      result.details = JSON.parse(result.details);
    }
    return result;
  },

  getAll: function(filters = {}) {
    const database = db.getDatabase();
    let sql = 'SELECT * FROM audit_logs WHERE 1=1';
    const params = [];

    if (filters.entity_type) {
      sql += ' AND entity_type = ?';
      params.push(filters.entity_type);
    }
    if (filters.action) {
      sql += ' AND action = ?';
      params.push(filters.action);
    }
    if (filters.entity_id) {
      sql += ' AND entity_id = ?';
      params.push(filters.entity_id);
    }

    sql += ' ORDER BY performed_at DESC';
    
    const stmt = database.prepare(sql);
    const results = stmt.all(...params);
    
    return results.map(r => ({
      ...r,
      details: r.details ? JSON.parse(r.details) : null
    }));
  },

  getExportPackage: function(filters = {}) {
    const logs = this.getAll(filters);
    
    return {
      export_time: db.getCurrentTime(),
      version: '1.0',
      total_records: logs.length,
      logs: logs
    };
  }
};

module.exports = models;
