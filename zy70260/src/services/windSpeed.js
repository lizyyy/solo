const { getDb } = require('../database');
const HistoryService = require('./history');
const {
  STATUS,
  ERROR_CODES,
  BusinessError,
  ENTITY_TYPES,
  OPERATIONS
} = require('../utils');

class WindSpeedService {
  static getLatest(location = 'main') {
    const db = getDb();
    const stmt = db.prepare(`
      SELECT * FROM wind_speed_monitor
      WHERE location = ?
      ORDER BY recorded_at DESC
      LIMIT 1
    `);
    return stmt.get(location);
  }

  static getHistory(location = 'main', limit = 20) {
    const db = getDb();
    const stmt = db.prepare(`
      SELECT * FROM wind_speed_monitor
      WHERE location = ?
      ORDER BY recorded_at DESC
      LIMIT ?
    `);
    return stmt.all(location, limit);
  }

  static determineStatus(windSpeed, thresholdWarning = 15, thresholdStop = 25) {
    if (windSpeed < 0) {
      throw new BusinessError(
        ERROR_CODES.WIND_SPEED_INVALID,
        '风速值无效：风速不能为负数'
      );
    }

    if (windSpeed >= thresholdStop) {
      return STATUS.WIND.STOPPED;
    } else if (windSpeed >= thresholdWarning) {
      return STATUS.WIND.WARNING;
    } else {
      return STATUS.WIND.NORMAL;
    }
  }

  static record(windSpeed, location = 'main', thresholdWarning = 15, thresholdStop = 25) {
    if (windSpeed < 0) {
      throw new BusinessError(
        ERROR_CODES.WIND_SPEED_INVALID,
        '风速值无效：风速不能为负数'
      );
    }

    const previous = WindSpeedService.getLatest(location);
    const newStatus = WindSpeedService.determineStatus(windSpeed, thresholdWarning, thresholdStop);

    const db = getDb();
    const stmt = db.prepare(`
      INSERT INTO wind_speed_monitor
      (location, wind_speed, status, threshold_warning, threshold_stop)
      VALUES (?, ?, ?, ?, ?)
    `);

    const result = stmt.run(location, windSpeed, newStatus, thresholdWarning, thresholdStop);

    const record = db.prepare(`SELECT * FROM wind_speed_monitor WHERE id = ?`).get(result.lastInsertRowid);

    if (previous && previous.status !== newStatus) {
      HistoryService.record(
        ENTITY_TYPES.WIND_SPEED,
        location,
        OPERATIONS.WIND_STATUS_CHANGE,
        { status: previous.status, wind_speed: previous.wind_speed },
        { status: newStatus, wind_speed: windSpeed }
      );
    }

    return record;
  }

  static isOperational(location = 'main') {
    const latest = WindSpeedService.getLatest(location);
    if (!latest) return true;
    return latest.status === STATUS.WIND.NORMAL;
  }

  static getCurrentStatus(location = 'main') {
    const latest = WindSpeedService.getLatest(location);
    if (!latest) {
      return {
        status: STATUS.WIND.NORMAL,
        wind_speed: 0,
        location,
        message: '暂无风速数据，默认正常运行'
      };
    }

    let message = '';
    switch (latest.status) {
      case STATUS.WIND.NORMAL:
        message = '风速正常，索道正常运行';
        break;
      case STATUS.WIND.WARNING:
        message = `风速预警（${latest.wind_speed}m/s），请注意安全`;
        break;
      case STATUS.WIND.STOPPED:
        message = `风速超标（${latest.wind_speed}m/s），索道已停运`;
        break;
    }

    return {
      status: latest.status,
      wind_speed: latest.wind_speed,
      location: latest.location,
      threshold_warning: latest.threshold_warning,
      threshold_stop: latest.threshold_stop,
      recorded_at: latest.recorded_at,
      message
    };
  }
}

module.exports = WindSpeedService;
