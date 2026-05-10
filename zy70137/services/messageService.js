const db = require('../db');
const { v4: uuidv4 } = require('uuid');
const frequencyCheckService = require('./frequencyCheckService');
const frequencyService = require('./frequencyService');
const statisticsService = require('./statisticsService');
const compensationService = require('./compensationService');

const messageService = {
  createMessage: (messageData) => {
    return new Promise((resolve, reject) => {
      const id = uuidv4();
      const now = new Date().toISOString();
      const { user_id, device_id, activity_id, content, priority = 0, check_details } = messageData;
      
      db.run(
        `INSERT INTO messages (id, user_id, device_id, activity_id, content, status, priority, created_at, check_details) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, user_id, device_id, activity_id, content, 'pending', priority, now, JSON.stringify(check_details || {})],
        function(err) {
          if (err) reject(err);
          else resolve({ id, ...messageData, status: 'pending', created_at: now });
        }
      );
    });
  },

  updateMessageStatus: (id, status, additionalData = {}) => {
    return new Promise((resolve, reject) => {
      const updates = [];
      const values = [];
      
      updates.push('status = ?');
      values.push(status);
      
      if (status === 'success') {
        updates.push('sent_at = ?');
        values.push(new Date().toISOString());
      }
      
      if (additionalData.failed_reason) {
        updates.push('failed_reason = ?');
        values.push(additionalData.failed_reason);
      }
      
      if (additionalData.check_result) {
        updates.push('check_result = ?');
        values.push(additionalData.check_result);
      }
      
      values.push(id);
      
      db.run(
        `UPDATE messages SET ${updates.join(', ')} WHERE id = ?`,
        values,
        function(err) {
          if (err) reject(err);
          else resolve({ id, status, affected: this.changes });
        }
      );
    });
  },

  recordAttempt: (messageId, attemptData) => {
    return new Promise((resolve, reject) => {
      const id = uuidv4();
      const now = new Date().toISOString();
      const { user_id, device_id, activity_id, status, frequency_check, frequency_limit, check_result, details } = attemptData;
      
      db.run(
        `INSERT INTO send_attempts (id, message_id, user_id, device_id, activity_id, status, frequency_check, frequency_limit, check_result, check_time, details) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, messageId, user_id, device_id, activity_id, status, frequency_check, frequency_limit, check_result, now, JSON.stringify(details || {})],
        function(err) {
          if (err) reject(err);
          else resolve({ id, message_id: messageId, check_time: now });
        }
      );
    });
  },

  getLastAttempt: (userId, deviceId, activityId) => {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT * FROM send_attempts 
         WHERE user_id = ? AND device_id = ? AND activity_id = ? 
         ORDER BY check_time DESC LIMIT 1`,
        [userId, deviceId, activityId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });
  },

  getMessageById: (id) => {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM messages WHERE id = ?', [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  },

  processSend: async (sendData) => {
    const { user_id, device_id, activity_id, activity_name, scene, content, priority = 0 } = sendData;
    const now = new Date().toISOString();

    const activeRules = await frequencyService.getActiveRules();
    
    const checkData = {
      user_id,
      device_id,
      activity_id,
      scene
    };
    
    const checkResult = await frequencyCheckService.checkAllRules(checkData, activeRules);

    const message = {
      user_id,
      device_id,
      activity_id,
      content,
      priority,
      check_details: checkResult
    };

    const savedMessage = await messageService.createMessage(message);
    const messageId = savedMessage.id;

    await messageService.recordAttempt(messageId, {
      user_id,
      device_id,
      activity_id,
      status: checkResult.passed ? 'allowed' : 'blocked',
      frequency_check: checkResult.passed ? '通过' : '被阻断',
      frequency_limit: checkResult.blocked_rule ? JSON.stringify(checkResult.blocked_rule) : null,
      check_result: checkResult.passed ? '允许发送' : '频控拦截',
      details: {
        activity_name,
        rules_checked: activeRules.length,
        check_details: checkResult.check_details
      }
    });

    if (!checkResult.passed) {
      await messageService.updateMessageStatus(messageId, 'blocked', {
        failed_reason: checkResult.blocked_rule ? 
          (checkResult.blocked_rule.message || `${checkResult.blocked_rule.name}: 已达${checkResult.blocked_rule.limit}条上限`) : 
          '频控检查未通过',
        check_result: 'blocked'
      });

      await statisticsService.incrementStats(activity_id, 'blocked');

      const lastAttempt = await messageService.getLastAttempt(user_id, device_id, activity_id);
      
      return {
        success: false,
        status: '被频控拦截',
        message: '发送被频控规则拦截',
        current_block: {
          rule: checkResult.blocked_rule ? checkResult.blocked_rule.name : '未知规则',
          reason: checkResult.check_details.find(d => d.status === 'blocked')?.reason || '频控检查未通过'
        },
        last_processing: lastAttempt ? {
          time: lastAttempt.check_time,
          result: lastAttempt.check_result,
          status: lastAttempt.status
        } : '无历史处理记录',
        message_id: messageId,
        check_summary: checkResult.check_details
      };
    }

    const sendSuccess = Math.random() > 0.1;

    if (sendSuccess) {
      await messageService.updateMessageStatus(messageId, 'success', { check_result: 'success' });
      
      if (device_id && activity_id) {
        await frequencyCheckService.markDeviceSent(device_id, activity_id, messageId);
      }

      await statisticsService.incrementStats(activity_id, 'success');

      return {
        success: true,
        status: '发送成功',
        message: '已通过所有频控检查并成功发送',
        message_id: messageId,
        check_summary: checkResult.check_details
      };
    } else {
      await messageService.updateMessageStatus(messageId, 'failed', {
        failed_reason: '发送通道异常，进入补偿队列',
        check_result: 'failed'
      });

      await statisticsService.incrementStats(activity_id, 'failed');

      await compensationService.addToCompensationQueue(
        { message_id: messageId, user_id, device_id, activity_id },
        '发送通道异常，首次发送失败'
      );

      return {
        success: false,
        status: '发送失败',
        message: '通过了频控检查，但实际发送失败，已进入补偿队列',
        message_id: messageId,
        check_summary: checkResult.check_details,
        next_retry: '5分钟后自动重试'
      };
    }
  }
};

module.exports = messageService;
