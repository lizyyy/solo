const { getQuery, allQuery, runQuery } = require('./database');

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function now() {
  return new Date().toISOString();
}

class BaseRepository {
  constructor(tableName) {
    this.tableName = tableName;
  }

  async findById(id) {
    return await getQuery(`SELECT * FROM ${this.tableName} WHERE id = ?`, [id]);
  }

  async findAll(filters = {}) {
    let sql = `SELECT * FROM ${this.tableName}`;
    const params = [];
    const conditions = [];

    Object.keys(filters).forEach(key => {
      if (filters[key] !== undefined && filters[key] !== null) {
        if (typeof filters[key] === 'string' && filters[key].includes('%')) {
          conditions.push(`${key} LIKE ?`);
        } else {
          conditions.push(`${key} = ?`);
        }
        params.push(filters[key]);
      }
    });

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }

    return await allQuery(sql, params);
  }

  async create(data) {
    const id = data.id || generateId();
    const finalData = { ...data, id, created_at: now() };
    const keys = Object.keys(finalData);
    const placeholders = keys.map(() => '?').join(', ');
    const values = keys.map(k => finalData[k]);

    await runQuery(
      `INSERT INTO ${this.tableName} (${keys.join(', ')}) VALUES (${placeholders})`,
      values
    );

    return await this.findById(id);
  }

  async update(id, data) {
    const updates = { ...data, last_updated: now() };
    const setClauses = Object.keys(updates).map(k => `${k} = ?`).join(', ');
    const values = [...Object.values(updates), id];

    await runQuery(
      `UPDATE ${this.tableName} SET ${setClauses} WHERE id = ?`,
      values
    );

    return await this.findById(id);
  }

  async delete(id) {
    return await runQuery(`DELETE FROM ${this.tableName} WHERE id = ?`, [id]);
  }
}

class ForkliftRepository extends BaseRepository {
  constructor() { super('forklifts'); }

  async findByStatus(status) {
    return await allQuery('SELECT * FROM forklifts WHERE status = ? ORDER BY battery_level ASC', [status]);
  }

  async findLowBattery(threshold = 30) {
    return await allQuery('SELECT * FROM forklifts WHERE battery_level <= ? ORDER BY battery_level ASC', [threshold]);
  }

  async updateBattery(id, batteryLevel) {
    return await this.update(id, { battery_level: batteryLevel, last_updated: now() });
  }
}

class ChargingStationRepository extends BaseRepository {
  constructor() { super('charging_stations'); }

  async findAvailable() {
    return await allQuery('SELECT * FROM charging_stations WHERE status = ?', ['available']);
  }

  async findByForklift(forkliftId) {
    return await getQuery('SELECT * FROM charging_stations WHERE current_forklift = ?', [forkliftId]);
  }

  async lockStation(id, forkliftId, driver, lockedUntil) {
    return await this.update(id, {
      status: 'locked',
      current_forklift: forkliftId,
      locked_by: driver,
      locked_until: lockedUntil,
      last_updated: now()
    });
  }

  async releaseStation(id) {
    return await this.update(id, {
      status: 'available',
      current_forklift: null,
      locked_by: null,
      locked_until: null,
      last_updated: now()
    });
  }
}

class ShiftRepository extends BaseRepository {
  constructor() { super('shifts'); }

  async findByDate(date) {
    return await allQuery('SELECT * FROM shifts WHERE date = ? ORDER BY start_time ASC', [date]);
  }

  async findByDateRange(startDate, endDate) {
    return await allQuery('SELECT * FROM shifts WHERE date >= ? AND date <= ? ORDER BY date ASC, start_time ASC', [startDate, endDate]);
  }

  async findByManager(manager) {
    return await allQuery('SELECT * FROM shifts WHERE manager = ? ORDER BY date DESC', [manager]);
  }
}

class AssignmentRepository extends BaseRepository {
  constructor() { super('assignments'); }

  async findByShift(shiftId) {
    return await allQuery('SELECT * FROM assignments WHERE shift_id = ?', [shiftId]);
  }

  async findByForkliftAndTime(forkliftId, startTime, endTime) {
    return await allQuery(`
      SELECT * FROM assignments 
      WHERE forklift_id = ? 
      AND status NOT IN ('cancelled', 'completed')
      AND (
        (start_time <= ? AND end_time >= ?)
        OR (start_time >= ? AND start_time <= ?)
      )
    `, [forkliftId, endTime, startTime, startTime, endTime]);
  }
}

class ChargingLockRepository extends BaseRepository {
  constructor() { super('charging_locks'); }

  async findActiveByStation(stationId) {
    return await getQuery('SELECT * FROM charging_locks WHERE station_id = ? AND status = ?', [stationId, 'locked']);
  }

  async findActiveByForklift(forkliftId) {
    return await getQuery('SELECT * FROM charging_locks WHERE forklift_id = ? AND status = ?', [forkliftId, 'locked']);
  }

  async findByShift(shiftId) {
    return await allQuery('SELECT * FROM charging_locks WHERE shift_id = ?', [shiftId]);
  }

  async releaseLock(id) {
    return await this.update(id, {
      status: 'released',
      actual_release_time: now()
    });
  }

  async findDuplicateLock(stationId, forkliftId, shiftId) {
    return await getQuery(`
      SELECT * FROM charging_locks 
      WHERE station_id = ? 
      AND forklift_id = ? 
      AND shift_id = ?
      AND status = ?
    `, [stationId, forkliftId, shiftId, 'locked']);
  }
}

class OperationLogRepository extends BaseRepository {
  constructor() { super('operation_logs'); }

  async findByOperator(operator, limit = 100) {
    return await allQuery('SELECT * FROM operation_logs WHERE operator = ? ORDER BY created_at DESC LIMIT ?', [operator, limit]);
  }

  async findByEntity(entityType, entityId) {
    return await allQuery('SELECT * FROM operation_logs WHERE entity_type = ? AND entity_id = ? ORDER BY created_at DESC', [entityType, entityId]);
  }

  async findByDateRange(startDate, endDate) {
    return await allQuery('SELECT * FROM operation_logs WHERE created_at >= ? AND created_at <= ? ORDER BY created_at DESC', [startDate, endDate]);
  }
}

class ExceptionRepository extends BaseRepository {
  constructor() { super('exceptions'); }

  async findUnhandled() {
    return await allQuery('SELECT * FROM exceptions WHERE handled = 0 ORDER BY created_at DESC');
  }

  async findByType(exceptionType) {
    return await allQuery('SELECT * FROM exceptions WHERE exception_type = ? ORDER BY created_at DESC', [exceptionType]);
  }

  async markHandled(id, handler) {
    return await this.update(id, {
      handled: 1,
      handler: handler,
      handled_at: now()
    });
  }
}

module.exports = {
  ForkliftRepository,
  ChargingStationRepository,
  ShiftRepository,
  AssignmentRepository,
  ChargingLockRepository,
  OperationLogRepository,
  ExceptionRepository
};
