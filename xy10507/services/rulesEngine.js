const db = require('../config/database');

class RulesEngine {
  static async checkCanLaunch(materialChannelId) {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT mc.*, c.name as channel_name, m.title as material_title, m.version
         FROM material_channels mc
         JOIN channels c ON mc.channel_id = c.id
         JOIN materials m ON mc.material_id = m.id
         WHERE mc.id = ?`,
        [materialChannelId],
        (err, mc) => {
          if (err) return reject(err);
          if (!mc) return reject(new Error('素材渠道关系不存在'));

          const violations = [];

          if (mc.review_status !== 'approved') {
            violations.push({
              rule: '审核状态检查',
              violation: '未审核不能上线',
              detail: `当前审核状态: ${mc.review_status}`,
              suggestion: '请先提交审核并等待通过'
            });
          }

          const remaining = mc.budget - mc.spent;
          if (remaining <= 0) {
            violations.push({
              rule: '预算检查',
              violation: '预算耗尽不能投',
              detail: `预算: ${mc.budget}, 已消耗: ${mc.spent}, 剩余: ${remaining}`,
              suggestion: '请增加预算或调整投放策略'
            });
          }

          if (violations.length > 0) {
            return resolve({
              canLaunch: false,
              violations,
              materialChannel: mc
            });
          }

          resolve({
            canLaunch: true,
            materialChannel: mc
          });
        }
      );
    });
  }

  static async checkChannelActiveVersion(materialId, channelId) {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT mc.*, m.version, m.title
         FROM material_channels mc
         JOIN materials m ON mc.material_id = m.id
         WHERE mc.channel_id = ? AND mc.is_active = 1 AND mc.status = 'running'`,
        [channelId],
        (err, activeMC) => {
          if (err) return reject(err);

          if (activeMC && activeMC.material_id !== materialId) {
            return resolve({
              hasConflict: true,
              activeVersion: activeMC,
              suggestion: '需要先暂停当前生效版本，新的同渠道版本才能上线'
            });
          }

          resolve({
            hasConflict: false
          });
        }
      );
    });
  }

  static async validateLaunch(materialChannelId) {
    const checkResult = await this.checkCanLaunch(materialChannelId);
    if (!checkResult.canLaunch) {
      return {
        success: false,
        errors: checkResult.violations,
        materialChannel: checkResult.materialChannel
      };
    }

    const channelCheck = await this.checkChannelActiveVersion(
      checkResult.materialChannel.material_id,
      checkResult.materialChannel.channel_id
    );

    if (channelCheck.hasConflict) {
      return {
        success: false,
        errors: [{
          rule: '同渠道版本唯一性检查',
          violation: '同渠道只能一个有效版本',
          detail: `渠道 [${channelCheck.activeVersion.channel_name}] 当前已有生效版本 [${channelCheck.activeVersion.version}]`,
          suggestion: channelCheck.suggestion
        }],
        materialChannel: checkResult.materialChannel
      };
    }

    return {
      success: true,
      materialChannel: checkResult.materialChannel
    };
  }

  static async checkBudgetBeforeSpend(materialChannelId, amount) {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT budget, spent, status FROM material_channels WHERE id = ?`,
        [materialChannelId],
        (err, mc) => {
          if (err) return reject(err);
          if (!mc) return reject(new Error('素材渠道关系不存在'));

          const remaining = mc.budget - mc.spent;
          const canSpend = remaining >= amount;

          resolve({
            canSpend,
            currentSpent: mc.spent,
            budget: mc.budget,
            remaining,
            required: amount,
            isRunning: mc.status === 'running'
          });
        }
      );
    });
  }

  static async checkIdempotent(requestId) {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT * FROM idempotent_records WHERE request_id = ?`,
        [requestId],
        (err, record) => {
          if (err) return reject(err);
          resolve(record ? JSON.parse(record.result) : null);
        }
      );
    });
  }

  static async saveIdempotentResult(requestId, action, result) {
    return new Promise((resolve, reject) => {
      const { v4: uuidv4 } = require('uuid');
      db.run(
        `INSERT INTO idempotent_records (id, request_id, action, result) VALUES (?, ?, ?, ?)`,
        [uuidv4(), requestId, action, JSON.stringify(result)],
        (err) => {
          if (err) return reject(err);
          resolve();
        }
      );
    });
  }
}

module.exports = RulesEngine;
