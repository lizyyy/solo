const db = require('../models/database');
const { v4: uuidv4 } = require('uuid');

class RateLimitService {
  static async recordCall(tenantId, apiGroupId, windowSizeSeconds = 60) {
    return new Promise((resolve, reject) => {
      db.serialize(async () => {
        try {
          const now = new Date();
          const windowStart = new Date(Math.floor(now.getTime() / (windowSizeSeconds * 1000)) * windowSizeSeconds * 1000);
          const windowEnd = new Date(windowStart.getTime() + windowSizeSeconds * 1000);

          const quota = await this.getTenantQuota(tenantId, apiGroupId);
          if (!quota) {
            return resolve({ success: false, reason: 'QUOTA_NOT_CONFIGURED', message: '租户配额未配置' });
          }

          const windowCallCount = await this.getSlidingWindowCount(tenantId, apiGroupId, now, windowSizeSeconds);

          if (windowCallCount >= 100) {
            await this.createRateLimitEvent(tenantId, apiGroupId, 'SLIDING_WINDOW', '滑动窗口超限', null);
            return resolve({ success: false, reason: 'SLIDING_WINDOW_LIMIT', message: '滑动窗口调用频率超限' });
          }

          if (quota.remaining_daily <= 0) {
            await this.createRateLimitEvent(tenantId, apiGroupId, 'DAILY_QUOTA', '日配额耗尽', null);
            return resolve({ success: false, reason: 'DAILY_QUOTA_EXHAUSTED', message: '日调用配额已耗尽' });
          }

          if (quota.remaining_monthly <= 0) {
            await this.createRateLimitEvent(tenantId, apiGroupId, 'MONTHLY_QUOTA', '月配额耗尽', null);
            return resolve({ success: false, reason: 'MONTHLY_QUOTA_EXHAUSTED', message: '月调用配额已耗尽' });
          }

          let window = await this.getOrCreateWindow(tenantId, apiGroupId, windowStart, windowEnd, windowSizeSeconds);
          await this.updateWindowCount(window.id, window.call_count + 1);
          await this.decrementQuota(tenantId, apiGroupId);

          resolve({
            success: true,
            windowCallCount: windowCallCount + 1,
            remainingDaily: quota.remaining_daily - 1,
            remainingMonthly: quota.remaining_monthly - 1
          });
        } catch (err) {
          reject(err);
        }
      });
    });
  }

  static getSlidingWindowCount(tenantId, apiGroupId, now, windowSizeSeconds) {
    return new Promise((resolve, reject) => {
      const windowStart = new Date(now.getTime() - windowSizeSeconds * 1000);
      db.get(`
        SELECT SUM(call_count) as total_count
        FROM call_windows
        WHERE tenant_id = ? AND api_group_id = ? AND window_end > ?
      `, [tenantId, apiGroupId, windowStart.toISOString()], (err, row) => {
        if (err) reject(err);
        else resolve(row.total_count || 0);
      });
    });
  }

  static getTenantQuota(tenantId, apiGroupId) {
    return new Promise((resolve, reject) => {
      db.get(`
        SELECT * FROM tenant_quotas
        WHERE tenant_id = ? AND api_group_id = ?
      `, [tenantId, apiGroupId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  static getOrCreateWindow(tenantId, apiGroupId, windowStart, windowEnd, windowSizeSeconds) {
    return new Promise((resolve, reject) => {
      db.get(`
        SELECT * FROM call_windows
        WHERE tenant_id = ? AND api_group_id = ? AND window_start = ?
      `, [tenantId, apiGroupId, windowStart.toISOString()], (err, row) => {
        if (err) return reject(err);
        if (row) return resolve(row);

        const windowId = uuidv4();
        db.run(`
          INSERT INTO call_windows (id, tenant_id, api_group_id, window_start, window_end, window_size_seconds, call_count)
          VALUES (?, ?, ?, ?, ?, ?, 0)
        `, [windowId, tenantId, apiGroupId, windowStart.toISOString(), windowEnd.toISOString(), windowSizeSeconds], function(err) {
          if (err) reject(err);
          else resolve({ id: windowId, call_count: 0 });
        });
      });
    });
  }

  static updateWindowCount(windowId, count) {
    return new Promise((resolve, reject) => {
      db.run(`UPDATE call_windows SET call_count = ? WHERE id = ?`, [count, windowId], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  static decrementQuota(tenantId, apiGroupId) {
    return new Promise((resolve, reject) => {
      db.run(`
        UPDATE tenant_quotas
        SET remaining_daily = remaining_daily - 1,
            remaining_monthly = remaining_monthly - 1,
            updated_at = CURRENT_TIMESTAMP
        WHERE tenant_id = ? AND api_group_id = ?
      `, [tenantId, apiGroupId], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  static createRateLimitEvent(tenantId, apiGroupId, eventType, reason, windowId) {
    return new Promise((resolve, reject) => {
      const eventId = uuidv4();
      db.run(`
        INSERT INTO rate_limit_events (id, tenant_id, api_group_id, event_type, reason, window_id, resolved)
        VALUES (?, ?, ?, ?, ?, ?, 0)
      `, [eventId, tenantId, apiGroupId, eventType, reason, windowId], function(err) {
        if (err) reject(err);
        else resolve(eventId);
      });
    });
  }

  static async compensateQuota(tenantId, apiGroupId, amount, reason, operator, rateLimitEventId = null) {
    return new Promise((resolve, reject) => {
      db.serialize(async () => {
        try {
          const compensationId = uuidv4();
          db.run(`
            INSERT INTO compensation_records (id, tenant_id, api_group_id, amount, reason, operator, rate_limit_event_id)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `, [compensationId, tenantId, apiGroupId, amount, reason, operator, rateLimitEventId]);

          db.run(`
            UPDATE tenant_quotas
            SET remaining_daily = remaining_daily + ?,
                remaining_monthly = remaining_monthly + ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE tenant_id = ? AND api_group_id = ?
          `, [amount, amount, tenantId, apiGroupId]);

          if (rateLimitEventId) {
            db.run(`
              UPDATE rate_limit_events
              SET resolved = 1, resolved_at = CURRENT_TIMESTAMP, resolved_by = ?
              WHERE id = ?
            `, [operator, rateLimitEventId]);
          }

          resolve({ success: true, compensationId });
        } catch (err) {
          reject(err);
        }
      });
    });
  }
}

module.exports = RateLimitService;
