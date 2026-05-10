const { v4: uuidv4 } = require('uuid');
const { sequelize } = require('../db');
const { ShortLink, AccessLog, Task } = require('../models');
const { getOrCreateDeviceFingerprint, getClientIP } = require('./deviceFingerprintService');
const { detectFraud } = require('./fraudDetectionService');
const blacklistService = require('./blacklistService');
const logger = require('../utils/logger');
const { withRetry, createRerunStrategy } = require('../utils/retry');

class ShortLinkAccessService {
  constructor(options = {}) {
    this.rerunStrategy = options.rerunStrategy || createRerunStrategy();
  }

  async processAccess(shortCode, req) {
    const requestId = uuidv4();
    const ipAddress = getClientIP(req);
    
    logger.info('Processing short link access', {
      requestId,
      shortCode,
      ipAddress,
    });
    
    const retryResult = await withRetry(
      () => this._processAccessTransaction(shortCode, req, requestId, ipAddress),
      { maxAttempts: 3 },
      { requestId, shortCode, ipAddress }
    );
    
    if (retryResult.success) {
      return retryResult.result;
    }
    
    await this._createFailedTask(shortCode, req, requestId, ipAddress, retryResult.error);
    
    throw retryResult.error;
  }

  async _processAccessTransaction(shortCode, req, requestId, ipAddress) {
    return sequelize.transaction(async (t) => {
      const shortLink = await this._validateShortLink(shortCode, t);
      
      if (!shortLink) {
        return {
          success: false,
          error: 'short_link_not_found',
          statusCode: 404,
        };
      }
      
      const deviceFingerprint = await getOrCreateDeviceFingerprint(req, t);
      
      const isBlacklisted = await this._checkBlacklist(ipAddress, deviceFingerprint.fingerprint);
      
      const fraudResult = await detectFraud({
        shortLinkId: shortLink.id,
        ipAddress,
        deviceFingerprint,
        blacklistService,
        transaction: t,
      });
      
      const isBot = deviceFingerprint.isBot;
      
      const isFraud = fraudResult.isFraud || isBlacklisted;
      
      const accessLog = await AccessLog.create({
        id: uuidv4(),
        shortLinkId: shortLink.id,
        deviceFingerprintId: deviceFingerprint.id,
        ipAddress,
        userAgent: req.headers['user-agent'],
        referrer: req.headers['referer'],
        isFraud,
        fraudReason: fraudResult.primaryReason,
        fraudScore: fraudResult.score,
        isBlacklisted,
        isBot,
        processed: true,
        requestId,
        attributes: {
          fraudDetails: fraudResult.details,
          deviceFingerprint: deviceFingerprint.fingerprint,
        },
      }, { transaction: t });
      
      await this._updateShortLinkStats(shortLink, isFraud, isBot, isBlacklisted, t);
      
      await this._queueProcessingTask(accessLog, shortLink, fraudResult, t);
      
      return {
        success: true,
        shortLink,
        accessLog,
        deviceFingerprint,
        isFraud,
        isBot,
        fraudScore: fraudResult.score,
        fraudReasons: fraudResult.reasons,
        shouldRedirect: !isFraud && !isBlacklisted && !isBot,
      };
    });
  }

  async _validateShortLink(shortCode, transaction) {
    const shortLink = await ShortLink.findOne({
      where: {
        shortCode,
        isActive: true,
      },
      transaction,
    });
    
    if (!shortLink) {
      return null;
    }
    
    const now = new Date();
    if (shortLink.expiresAt && shortLink.expiresAt < now) {
      logger.info('Short link expired', { shortCode });
      return null;
    }
    
    if (shortLink.maxClicks && shortLink.totalClicks >= shortLink.maxClicks) {
      logger.info('Short link max clicks reached', { shortCode });
      return null;
    }
    
    return shortLink;
  }

  async _checkBlacklist(ipAddress, fingerprint) {
    const ipBlacklist = await blacklistService.check('ip', ipAddress);
    if (ipBlacklist) {
      logger.info('IP blacklist hit', { ipAddress, severity: ipBlacklist.severity });
      return true;
    }
    
    const fingerprintBlacklist = await blacklistService.check('fingerprint', fingerprint);
    if (fingerprintBlacklist) {
      logger.info('Fingerprint blacklist hit', { fingerprint, severity: fingerprintBlacklist.severity });
      return true;
    }
    
    return false;
  }

  async _updateShortLinkStats(shortLink, isFraud, isBot, isBlacklisted, transaction) {
    const updates = {
      totalClicks: shortLink.totalClicks + 1,
    };
    
    if (isFraud || isBlacklisted) {
      updates.fraudClicks = shortLink.fraudClicks + 1;
    } else if (!isBot) {
      updates.validClicks = shortLink.validClicks + 1;
    }
    
    await shortLink.update(updates, { transaction });
  }

  async _queueProcessingTask(accessLog, shortLink, fraudResult, transaction) {
    if (fraudResult.isFraud) {
      await Task.create({
        type: 'update_blacklist',
        referenceId: accessLog.id,
        payload: {
          ipAddress: accessLog.ipAddress,
          fraudReason: fraudResult.primaryReason,
          fraudScore: fraudResult.score,
          shortLinkId: shortLink.id,
        },
        status: 'pending',
        priority: 5,
      }, { transaction });
    }
  }

  async _createFailedTask(shortCode, req, requestId, ipAddress, error) {
    try {
      await Task.create({
        type: 'process_access_log',
        payload: {
          shortCode,
          ipAddress,
          requestId,
          headers: {
            userAgent: req.headers['user-agent'],
            referer: req.headers['referer'],
          },
          error: error.message,
        },
        status: 'failed',
        errorMessage: error.message,
        errorStack: error.stack,
        attemptCount: 1,
        nextAttemptAt: new Date(Date.now() + 60000),
      });
      
      logger.error('Short link access failed, task created for retry', {
        requestId,
        shortCode,
        error: error.message,
      });
    } catch (taskError) {
      logger.error('Failed to create failed task', {
        requestId,
        error: taskError.message,
      });
    }
  }

  async rerunFailedTask(taskId) {
    const task = await Task.findByPk(taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }
    
    if (task.type !== 'process_access_log') {
      throw new Error(`Cannot rerun task type: ${task.type}`);
    }
    
    const { shortCode, ipAddress, headers } = task.payload || {};
    
    const fakeReq = {
      headers: headers || {},
      ip: ipAddress,
    };
    
    return this.rerunStrategy.rerunFailedTask(
      taskId,
      'process_access_log',
      async () => {
        await task.update({
          status: 'processing',
          attemptCount: task.attemptCount + 1,
          lastAttemptAt: new Date(),
        });
        
        const result = await this.processAccess(shortCode, fakeReq);
        
        await task.update({
          status: 'completed',
          completedAt: new Date(),
          result,
        });
        
        return result;
      }
    );
  }

  async rerunAllFailed() {
    const failedTasks = await Task.findFailedToRetry(50);
    
    const results = [];
    
    for (const task of failedTasks) {
      try {
        const result = await this.rerunFailedTask(task.id);
        results.push({
          taskId: task.id,
          success: true,
          ...result,
        });
      } catch (error) {
        await task.update({
          status: 'failed',
          errorMessage: error.message,
          nextAttemptAt: new Date(Date.now() + 5 * 60000),
        });
        
        results.push({
          taskId: task.id,
          success: false,
          error: error.message,
        });
      }
    }
    
    return results;
  }
}

module.exports = new ShortLinkAccessService();
module.exports.ShortLinkAccessService = ShortLinkAccessService;
