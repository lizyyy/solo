const { Op } = require('sequelize');
const { Blacklist } = require('../models');
const logger = require('../utils/logger');

class BlacklistService {
  async check(type, value) {
    if (!type || !value) {
      return null;
    }
    
    const now = new Date();
    
    const blacklistEntry = await Blacklist.findOne({
      where: {
        type,
        value,
        isActive: true,
        [Op.or]: [
          { expiresAt: null },
          { expiresAt: { [Op.gt]: now } },
        ],
      },
    });
    
    if (blacklistEntry) {
      logger.debug('Blacklist hit', {
        type,
        value,
        severity: blacklistEntry.severity,
        reason: blacklistEntry.reason,
      });
    }
    
    return blacklistEntry;
  }

  async add(type, value, options = {}) {
    const {
      reason,
      severity = 'medium',
      source = 'system',
      expiresInHours,
      metadata = {},
    } = options;
    
    const now = new Date();
    const expiresAt = expiresInHours 
      ? new Date(now.getTime() + expiresInHours * 60 * 60 * 1000)
      : null;
    
    const [entry, created] = await Blacklist.findOrCreate({
      where: { type, value },
      defaults: {
        reason,
        severity,
        source,
        isActive: true,
        expiresAt,
        metadata,
      },
    });
    
    if (!created) {
      await entry.update({
        reason: reason || entry.reason,
        severity,
        source,
        isActive: true,
        expiresAt: expiresAt || entry.expiresAt,
        metadata: { ...entry.metadata, ...metadata },
      });
    }
    
    logger.info('Added to blacklist', {
      type,
      value,
      severity,
      created,
    });
    
    return entry;
  }

  async remove(type, value) {
    const entry = await Blacklist.findOne({
      where: { type, value, isActive: true },
    });
    
    if (entry) {
      await entry.update({ isActive: false });
      logger.info('Removed from blacklist', { type, value });
      return true;
    }
    
    return false;
  }

  async incrementBlockCount(blacklistId) {
    return Blacklist.increment('blockCount', {
      where: { id: blacklistId },
    });
  }

  async batchAdd(entries) {
    const results = [];
    
    for (const entry of entries) {
      try {
        const result = await this.add(entry.type, entry.value, entry);
        results.push({ success: true, type: entry.type, value: entry.value });
      } catch (error) {
        logger.error('Failed to add blacklist entry', {
          type: entry.type,
          value: entry.value,
          error: error.message,
        });
        results.push({ 
          success: false, 
          type: entry.type, 
          value: entry.value,
          error: error.message 
        });
      }
    }
    
    return results;
  }

  async cleanupExpired() {
    const now = new Date();
    
    const result = await Blacklist.update(
      { isActive: false },
      {
        where: {
          expiresAt: { [Op.lt]: now },
          isActive: true,
        },
      }
    );
    
    logger.info('Cleaned up expired blacklist entries', {
      count: result[0],
    });
    
    return result[0];
  }

  async list({ type, severity, activeOnly = true, limit = 100, offset = 0 } = {}) {
    const where = {};
    
    if (type) where.type = type;
    if (severity) where.severity = severity;
    if (activeOnly) where.isActive = true;
    
    return Blacklist.findAndCountAll({
      where,
      limit,
      offset,
      order: [['createdAt', 'DESC']],
    });
  }

  async addIp(ip, options = {}) {
    return this.add('ip', ip, options);
  }

  async addFingerprint(fingerprint, options = {}) {
    return this.add('fingerprint', fingerprint, options);
  }

  async addUserAgent(userAgent, options = {}) {
    return this.add('user_agent', userAgent, options);
  }

  async checkIp(ip) {
    return this.check('ip', ip);
  }

  async checkFingerprint(fingerprint) {
    return this.check('fingerprint', fingerprint);
  }
}

module.exports = new BlacklistService();
module.exports.BlacklistService = BlacklistService;
