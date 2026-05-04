const { v4: uuidv4 } = require('uuid');
const dayjs = require('dayjs');
const db = require('../database');

class RateLimitService {
  constructor() {
    this.windowStores = new Map();
  }

  _getFixedWindowStart(timestamp, windowSeconds) {
    const windowMs = windowSeconds * 1000;
    return Math.floor(timestamp / windowMs) * windowMs;
  }

  _getSlidingWindowRange(timestamp, windowSeconds) {
    const windowMs = windowSeconds * 1000;
    return {
      start: timestamp - windowMs,
      end: timestamp
    };
  }

  async checkRateLimit(appKey, path, method = 'GET', timestamp = Date.now()) {
    const appKeyRecord = db.get(
      'SELECT id FROM app_keys WHERE app_key = ? AND is_active = 1',
      [appKey]
    );

    if (!appKeyRecord) {
      return {
        allowed: false,
        reason: 'invalid_app_key',
        message: 'App key not found or inactive'
      };
    }

    const routeRecord = db.get(
      'SELECT id FROM routes WHERE path = ? AND method = ? AND is_active = 1',
      [path, method]
    );

    if (!routeRecord) {
      return {
        allowed: true,
        reason: 'no_route_config',
        message: 'No rate limit configured for this route'
      };
    }

    const configRecord = db.get(
      `SELECT * FROM rate_limit_configs 
       WHERE app_key_id = ? AND route_id = ? AND is_active = 1`,
      [appKeyRecord.id, routeRecord.id]
    );

    if (!configRecord) {
      return {
        allowed: true,
        reason: 'no_limit_config',
        message: 'No rate limit configured for this app key and route'
      };
    }

    const { algorithm, request_limit: limit, window_seconds: windowSeconds } = configRecord;
    let countInWindow = 0;
    let windowStart = null;
    let windowEnd = null;

    if (algorithm === 'fixed-window') {
      windowStart = this._getFixedWindowStart(timestamp, windowSeconds);
      windowEnd = windowStart + windowSeconds * 1000;

      const windowLogs = db.all(
        `SELECT COUNT(*) as count FROM request_logs 
         WHERE app_key_id = ? AND route_id = ? 
         AND timestamp >= ? AND timestamp < ?`,
        [appKeyRecord.id, routeRecord.id, windowStart, windowEnd]
      );
      
      countInWindow = windowLogs[0]?.count || 0;
    } else if (algorithm === 'sliding-window') {
      const windowRange = this._getSlidingWindowRange(timestamp, windowSeconds);
      windowStart = windowRange.start;
      windowEnd = windowRange.end;

      const windowLogs = db.all(
        `SELECT COUNT(*) as count FROM request_logs 
         WHERE app_key_id = ? AND route_id = ? 
         AND timestamp >= ? AND timestamp < ?`,
        [appKeyRecord.id, routeRecord.id, windowStart, windowEnd]
      );
      
      countInWindow = windowLogs[0]?.count || 0;
    }

    const allowed = countInWindow < limit;
    const action = allowed ? 'allowed' : 'rejected';
    const requestId = uuidv4();

    db.run(
      `INSERT INTO request_logs 
       (app_key_id, route_id, request_id, timestamp, algorithm, 
        request_limit, window_seconds, count_in_window, action, window_start, window_end, details)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        appKeyRecord.id,
        routeRecord.id,
        requestId,
        timestamp,
        algorithm,
        limit,
        windowSeconds,
        countInWindow,
        action,
        windowStart,
        windowEnd,
        JSON.stringify({
          algorithm,
          limit,
          windowSeconds,
          currentCount: countInWindow,
          remaining: allowed ? limit - countInWindow - 1 : 0
        })
      ]
    );

    return {
      allowed,
      action,
      requestId,
      algorithm,
      limit,
      windowSeconds,
      currentCount: countInWindow,
      remaining: allowed ? limit - countInWindow - 1 : 0,
      windowStart: dayjs(windowStart).toISOString(),
      windowEnd: dayjs(windowEnd).toISOString(),
      timestamp: dayjs(timestamp).toISOString()
    };
  }

  async simulateConcurrentRequests(appKey, path, method, requestCount, algorithm = null) {
    const results = [];
    const baseTime = Date.now();

    for (let i = 0; i < requestCount; i++) {
      const result = await this.checkRateLimit(appKey, path, method, baseTime);
      results.push({
        index: i,
        ...result
      });
    }

    const allowedCount = results.filter(r => r.allowed).length;
    const rejectedCount = results.filter(r => !r.allowed).length;

    return {
      totalRequests: requestCount,
      allowedCount,
      rejectedCount,
      allowedRate: allowedCount / requestCount,
      results
    };
  }

  async simulateTimeline(appKey, path, method, timestamps, algorithm = null) {
    const results = [];

    for (const timestamp of timestamps) {
      const result = await this.checkRateLimit(appKey, path, method, timestamp);
      results.push({
        timestamp: dayjs(timestamp).toISOString(),
        ...result
      });
    }

    const allowedCount = results.filter(r => r.allowed).length;
    const rejectedCount = results.filter(r => !r.allowed).length;

    return {
      totalRequests: timestamps.length,
      allowedCount,
      rejectedCount,
      allowedRate: allowedCount / timestamps.length,
      results
    };
  }

  getStatistics(startTime, endTime) {
    const totalRequests = db.get(
      'SELECT COUNT(*) as count FROM request_logs WHERE timestamp >= ? AND timestamp <= ?',
      [startTime, endTime]
    )?.count || 0;

    const allowedRequests = db.get(
      'SELECT COUNT(*) as count FROM request_logs WHERE action = ? AND timestamp >= ? AND timestamp <= ?',
      ['allowed', startTime, endTime]
    )?.count || 0;

    const rejectedRequests = db.get(
      'SELECT COUNT(*) as count FROM request_logs WHERE action = ? AND timestamp >= ? AND timestamp <= ?',
      ['rejected', startTime, endTime]
    )?.count || 0;

    const algorithmStats = db.all(
      `SELECT algorithm, 
              COUNT(*) as total,
              SUM(CASE WHEN action = 'allowed' THEN 1 ELSE 0 END) as allowed,
              SUM(CASE WHEN action = 'rejected' THEN 1 ELSE 0 END) as rejected
       FROM request_logs 
       WHERE timestamp >= ? AND timestamp <= ?
       GROUP BY algorithm`,
      [startTime, endTime]
    );

    const appKeyStats = db.all(
      `SELECT ak.app_key, ak.name,
              COUNT(*) as total,
              SUM(CASE WHEN rl.action = 'allowed' THEN 1 ELSE 0 END) as allowed,
              SUM(CASE WHEN rl.action = 'rejected' THEN 1 ELSE 0 END) as rejected
       FROM request_logs rl
       JOIN app_keys ak ON rl.app_key_id = ak.id
       WHERE rl.timestamp >= ? AND rl.timestamp <= ?
       GROUP BY ak.id, ak.app_key, ak.name`,
      [startTime, endTime]
    );

    return {
      period: {
        start: dayjs(startTime).toISOString(),
        end: dayjs(endTime).toISOString()
      },
      summary: {
        totalRequests,
        allowedRequests,
        rejectedRequests,
        allowedRate: totalRequests > 0 ? allowedRequests / totalRequests : 0,
        rejectedRate: totalRequests > 0 ? rejectedRequests / totalRequests : 0
      },
      algorithmStats,
      appKeyStats
    };
  }

  analyzeBoundaryMisallows(appKey, path, method, windowSeconds, testDurationSeconds = 10) {
    const appKeyRecord = db.get(
      'SELECT id FROM app_keys WHERE app_key = ? AND is_active = 1',
      [appKey]
    );

    if (!appKeyRecord) {
      return { error: 'Invalid app key' };
    }

    const routeRecord = db.get(
      'SELECT id FROM routes WHERE path = ? AND method = ? AND is_active = 1',
      [path, method]
    );

    if (!routeRecord) {
      return { error: 'Invalid route' };
    }

    const fixedWindowLogs = db.all(
      `SELECT * FROM request_logs 
       WHERE app_key_id = ? AND route_id = ? AND algorithm = 'fixed-window'
       ORDER BY timestamp`,
      [appKeyRecord.id, routeRecord.id]
    );

    const slidingWindowLogs = db.all(
      `SELECT * FROM request_logs 
       WHERE app_key_id = ? AND route_id = ? AND algorithm = 'sliding-window'
       ORDER BY timestamp`,
      [appKeyRecord.id, routeRecord.id]
    );

    const boundaryDifferences = [];
    
    if (fixedWindowLogs.length > 0 && slidingWindowLogs.length > 0) {
      const minLen = Math.min(fixedWindowLogs.length, slidingWindowLogs.length);
      
      for (let i = 0; i < minLen; i++) {
        const fixedLog = fixedWindowLogs[i];
        const slidingLog = slidingWindowLogs[i];
        
        if (fixedLog.action !== slidingLog.action) {
          boundaryDifferences.push({
            index: i,
            timestamp: dayjs(fixedLog.timestamp).toISOString(),
            fixedWindowAction: fixedLog.action,
            slidingWindowAction: slidingLog.action,
            fixedWindowCount: fixedLog.count_in_window,
            slidingWindowCount: slidingLog.count_in_window,
            difference: fixedLog.action === 'allowed' && slidingLog.action === 'rejected' 
              ? 'fixed_allowed_sliding_rejected'
              : 'fixed_rejected_sliding_allowed'
          });
        }
      }
    }

    return {
      appKey,
      path,
      method,
      windowSeconds,
      boundaryDifferences,
      differenceCount: boundaryDifferences.length,
      fixedWindowStats: {
        total: fixedWindowLogs.length,
        allowed: fixedWindowLogs.filter(l => l.action === 'allowed').length,
        rejected: fixedWindowLogs.filter(l => l.action === 'rejected').length
      },
      slidingWindowStats: {
        total: slidingWindowLogs.length,
        allowed: slidingWindowLogs.filter(l => l.action === 'allowed').length,
        rejected: slidingWindowLogs.filter(l => l.action === 'rejected').length
      }
    };
  }

  clearLogs(appKeyId = null, routeId = null) {
    let sql = 'DELETE FROM request_logs WHERE 1=1';
    const params = [];

    if (appKeyId) {
      sql += ' AND app_key_id = ?';
      params.push(appKeyId);
    }

    if (routeId) {
      sql += ' AND route_id = ?';
      params.push(routeId);
    }

    const result = db.run(sql, params);
    return { deleted: result?.changes || 0 };
  }
}

module.exports = new RateLimitService();
