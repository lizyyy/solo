const db = require('../db');
const { v4: uuidv4 } = require('uuid');
const moment = require('moment');

const frequencyCheckService = {
  getTimeWindowStart: (unit) => {
    const now = moment();
    switch (unit) {
      case 'minute':
        return now.startOf('minute').toISOString();
      case 'hour':
        return now.startOf('hour').toISOString();
      case 'day':
        return now.startOf('day').toISOString();
      default:
        return now.startOf('day').toISOString();
    }
  },

  getUserSendCount: (userId, timeWindowStart) => {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT COUNT(*) as count FROM messages 
         WHERE user_id = ? AND status = 'success' AND sent_at >= ?`,
        [userId, timeWindowStart],
        (err, row) => {
          if (err) reject(err);
          else resolve(row ? row.count : 0);
        }
      );
    });
  },

  getDeviceSendCount: (deviceId, timeWindowStart) => {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT COUNT(*) as count FROM messages 
         WHERE device_id = ? AND status = 'success' AND sent_at >= ?`,
        [deviceId, timeWindowStart],
        (err, row) => {
          if (err) reject(err);
          else resolve(row ? row.count : 0);
        }
      );
    });
  },

  getSceneSendCount: (scene, timeWindowStart) => {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT COUNT(*) as count FROM messages m
         JOIN activities a ON m.activity_id = a.id
         WHERE a.scene = ? AND m.status = 'success' AND m.sent_at >= ?`,
        [scene, timeWindowStart],
        (err, row) => {
          if (err) reject(err);
          else resolve(row ? row.count : 0);
        }
      );
    });
  },

  checkDeviceDedup: (deviceId, activityId) => {
    return new Promise((resolve, reject) => {
      db.get(
        'SELECT * FROM device_dedup WHERE device_id = ? AND activity_id = ?',
        [deviceId, activityId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row ? { exists: true, record: row } : { exists: false });
        }
      );
    });
  },

  markDeviceSent: (deviceId, activityId, messageId) => {
    return new Promise((resolve, reject) => {
      const now = new Date().toISOString();
      const id = uuidv4();
      db.run(
        `INSERT INTO device_dedup (id, device_id, activity_id, message_id, sent_at)
         VALUES (?, ?, ?, ?, ?)`,
        [id, deviceId, activityId, messageId, now],
        function(err) {
          if (err) reject(err);
          else resolve({ id, deviceId, activityId, sent_at: now });
        }
      );
    });
  },

  checkAllRules: async function(messageData, rules) {
    const results = {
      passed: true,
      blocked_rule: null,
      check_details: [],
      user_counts: {},
      device_counts: {},
      scene_counts: {}
    };

    for (const rule of rules) {
      if (!rule.is_active) continue;

      const timeWindowStart = this.getTimeWindowStart(rule.unit);
      let currentCount = 0;
      let dimension = '';
      let dimensionValue = '';

      switch (rule.type) {
        case 'user':
          if (!messageData.user_id) {
            results.check_details.push({
              rule_name: rule.name,
              status: 'skip',
              reason: '无用户ID，跳过用户级频控'
            });
            continue;
          }
          currentCount = await this.getUserSendCount(messageData.user_id, timeWindowStart);
          dimension = '用户';
          dimensionValue = messageData.user_id;
          results.user_counts[rule.scope] = { current: currentCount, limit: rule.limit_count };
          break;

        case 'device':
          if (!messageData.device_id) {
            results.check_details.push({
              rule_name: rule.name,
              status: 'skip',
              reason: '无设备ID，跳过设备级频控'
            });
            continue;
          }
          currentCount = await this.getDeviceSendCount(messageData.device_id, timeWindowStart);
          dimension = '设备';
          dimensionValue = messageData.device_id;
          results.device_counts[rule.scope] = { current: currentCount, limit: rule.limit_count };
          break;

        case 'scene':
          if (!messageData.scene) {
            results.check_details.push({
              rule_name: rule.name,
              status: 'skip',
              reason: '无场景信息，跳过场景级频控'
            });
            continue;
          }
          currentCount = await this.getSceneSendCount(messageData.scene, timeWindowStart);
          dimension = '场景';
          dimensionValue = messageData.scene;
          results.scene_counts[rule.scope] = { current: currentCount, limit: rule.limit_count };
          break;
      }

      const checkResult = currentCount < rule.limit_count;
      
      const detail = {
        rule_name: rule.name,
        rule_type: rule.type,
        dimension: dimension,
        dimension_value: dimensionValue,
        current_count: currentCount,
        limit_count: rule.limit_count,
        time_window: `${rule.time_window}${rule.unit}`,
        status: checkResult ? 'pass' : 'blocked',
        reason: checkResult ? `当前${currentCount}条，未超过${rule.limit_count}条限制` : 
          `${dimension}[${dimensionValue}]在${rule.time_window}${rule.unit}内已发送${currentCount}条，达到${rule.limit_count}条上限`
      };
      results.check_details.push(detail);

      if (!checkResult) {
        results.passed = false;
        results.blocked_rule = {
          name: rule.name,
          type: rule.type,
          limit: rule.limit_count,
          current: currentCount,
          time_window: `${rule.time_window}${rule.unit}`
        };
        break;
      }
    }

    if (results.passed && messageData.device_id && messageData.activity_id) {
      const dedupCheck = await this.checkDeviceDedup(messageData.device_id, messageData.activity_id);
      if (dedupCheck.exists) {
        results.passed = false;
        results.blocked_rule = {
          name: '设备活动去重',
          type: 'dedup',
          message: '该设备在本活动中已收到过推送'
        };
        results.check_details.push({
          rule_name: '设备活动去重',
          status: 'blocked',
          reason: `设备[${messageData.device_id}]在活动[${messageData.activity_id}]中已接收过推送，上次发送时间: ${dedupCheck.record.sent_at}`
        });
      } else {
        results.check_details.push({
          rule_name: '设备活动去重',
          status: 'pass',
          reason: '该设备在本活动中未发送过'
        });
      }
    }

    return results;
  }
};

module.exports = frequencyCheckService;
