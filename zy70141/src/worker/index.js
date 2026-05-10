require('dotenv').config();
const { Op } = require('sequelize');
const logger = require('../utils/logger');
const { connect, disconnect } = require('../db');
const { setupAssociations, Task, AccessLog } = require('../models');
const shortLinkAccessService = require('../services/shortLinkAccessService');
const { processPendingConversions, generateAttributionReport } = require('../services/attributionService');
const blacklistService = require('../services/blacklistService');
const { withRetry, createRerunStrategy } = require('../utils/retry');

const rerunStrategy = createRerunStrategy();

class Worker {
  constructor() {
    this.isRunning = false;
    this.pollInterval = 5000;
    this.concurrency = 5;
    this.processingTasks = new Set();
  }

  async start() {
    logger.info('Starting background worker...');
    
    await connect();
    setupAssociations();
    
    this.isRunning = true;
    this.pollLoop();
    
    logger.info('Background worker started');
  }

  async pollLoop() {
    while (this.isRunning) {
      try {
        const tasks = await this.getPendingTasks();
        
        for (const task of tasks) {
          if (this.processingTasks.size < this.concurrency && !this.processingTasks.has(task.id)) {
            this.processTask(task);
          }
        }
        
        await this.sleep(this.pollInterval);
      } catch (error) {
        logger.error('Error in poll loop:', error);
        await this.sleep(this.pollInterval * 2);
      }
    }
  }

  async getPendingTasks() {
    const now = new Date();
    
    return Task.findAll({
      where: {
        status: 'pending',
        nextAttemptAt: { [Op.lte]: now },
        attemptCount: { [Op.lt]: require('sequelize').col('maxAttempts') },
      },
      order: [
        ['priority', 'DESC'],
        ['createdAt', 'ASC'],
      ],
      limit: this.concurrency,
    });
  }

  async processTask(task) {
    this.processingTasks.add(task.id);
    
    try {
      logger.info('Processing task', {
        taskId: task.id,
        type: task.type,
        attempt: task.attemptCount + 1,
      });
      
      await task.update({
        status: 'processing',
        attemptCount: task.attemptCount + 1,
        lastAttemptAt: new Date(),
        startedAt: task.startedAt || new Date(),
      });
      
      const result = await this.executeTask(task);
      
      await task.update({
        status: 'completed',
        completedAt: new Date(),
        result,
      });
      
      logger.info('Task completed', {
        taskId: task.id,
        type: task.type,
      });
    } catch (error) {
      logger.error('Task failed', {
        taskId: task.id,
        type: task.type,
        error: error.message,
        attempt: task.attemptCount,
      });
      
      const isLastAttempt = task.attemptCount >= task.maxAttempts;
      
      await task.update({
        status: isLastAttempt ? 'failed' : 'pending',
        errorMessage: error.message,
        errorStack: error.stack,
        nextAttemptAt: isLastAttempt 
          ? null 
          : new Date(Date.now() + Math.pow(2, task.attemptCount) * 10000),
      });
      
      if (isLastAttempt) {
        logger.error('Task failed permanently', {
          taskId: task.id,
          type: task.type,
        });
      }
    } finally {
      this.processingTasks.delete(task.id);
    }
  }

  async executeTask(task) {
    const result = await withRetry(
      () => this._executeTaskInner(task),
      { maxAttempts: 2 },
      { taskId: task.id, type: task.type }
    );
    
    if (!result.success) {
      throw result.error;
    }
    
    return result.result;
  }

  async _executeTaskInner(task) {
    switch (task.type) {
      case 'process_access_log':
        return this.processAccessLogTask(task);
        
      case 'process_conversion':
        return this.processConversionTask(task);
        
      case 'generate_report':
        return this.generateReportTask(task);
        
      case 'update_blacklist':
        return this.updateBlacklistTask(task);
        
      case 'cleanup_old_data':
        return this.cleanupOldDataTask(task);
        
      default:
        throw new Error(`Unknown task type: ${task.type}`);
    }
  }

  async processAccessLogTask(task) {
    const { shortCode, headers, ipAddress } = task.payload || {};
    
    if (!shortCode) {
      throw new Error('Missing shortCode in task payload');
    }
    
    const fakeReq = {
      headers: headers || {},
      ip: ipAddress,
    };
    
    const result = await shortLinkAccessService.processAccess(shortCode, fakeReq);
    return result;
  }

  async processConversionTask(task) {
    const results = await processPendingConversions();
    return results;
  }

  async generateReportTask(task) {
    const { reportDate, shortLinkId } = task.payload || {};
    
    if (!reportDate || !shortLinkId) {
      throw new Error('Missing required fields for report generation');
    }
    
    const report = await generateAttributionReport(
      new Date(reportDate),
      shortLinkId
    );
    
    return { reportId: report.id };
  }

  async updateBlacklistTask(task) {
    const { ipAddress, fraudReason, fraudScore, shortLinkId } = task.payload || {};
    
    if (!ipAddress) {
      throw new Error('Missing ipAddress in task payload');
    }
    
    const severity = fraudScore >= 0.8 ? 'high' : 'medium';
    
    const entry = await blacklistService.add('ip', ipAddress, {
      reason: `${fraudReason || 'fraudulent_activity'} - score: ${fraudScore}`,
      severity,
      source: 'fraud_detection',
      expiresInHours: 24,
      metadata: { shortLinkId, fraudScore, fraudReason },
    });
    
    return { blacklistEntryId: entry.id };
  }

  async cleanupOldDataTask(task) {
    const { retentionDays = 90 } = task.payload || {};
    
    const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
    
    const deletedLogs = await AccessLog.destroy({
      where: {
        createdAt: { [Op.lt]: cutoffDate },
        isFraud: false,
        isBot: false,
      },
    });
    
    const deletedTasks = await Task.destroy({
      where: {
        createdAt: { [Op.lt]: cutoffDate },
        status: 'completed',
      },
    });
    
    return {
      deletedAccessLogs: deletedLogs,
      deletedTasks: deletedTasks,
    };
  }

  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async stop() {
    logger.info('Stopping worker...');
    this.isRunning = false;
    
    while (this.processingTasks.size > 0) {
      logger.info(`Waiting for ${this.processingTasks.size} tasks to complete...`);
      await this.sleep(1000);
    }
    
    await disconnect();
    logger.info('Worker stopped');
  }
}

const worker = new Worker();

process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, stopping worker...');
  await worker.stop();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, stopping worker...');
  await worker.stop();
  process.exit(0);
});

if (require.main === module) {
  worker.start();
}

module.exports = { Worker, worker };
