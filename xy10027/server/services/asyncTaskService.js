const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
const { redis } = require('../config/redis');
const logger = require('../utils/logger');
const AuditService = require('./auditService');

class AsyncTaskService {
  static MAX_RETRIES = 5;
  static RETRY_DELAY_BASE = 1000;
  static TASK_QUEUE_KEY = 'async_task_queue';
  static TASK_PROCESSING_KEY = 'async_tasks_processing';

  static handlers = new Map();

  static registerHandler(taskType, handler) {
    this.handlers.set(taskType, handler);
    logger.info(`Handler registered for task type: ${taskType}`);
  }

  static async enqueueTask(taskType, data, userId, priority = 0, client = null) {
    const taskId = uuidv4();
    const query = `
      INSERT INTO sync_queue (
        id, user_id, operation_type, data, status, priority, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
    `;

    const queryClient = client || db;
    await queryClient.query(query, [taskId, userId, taskType, JSON.stringify(data), 'pending', priority]);

    await redis.zadd(this.TASK_QUEUE_KEY, priority, taskId);
    logger.info(`Task enqueued: ${taskId}, type: ${taskType}`);

    return taskId;
  }

  static async processNextTask() {
    const result = await redis.zpopmax(this.TASK_QUEUE_KEY, 1);
    
    if (result.length === 0) {
      return null;
    }

    const taskId = result[0];
    
    const isProcessing = await redis.sismember(this.TASK_PROCESSING_KEY, taskId);
    if (isProcessing) {
      logger.warn(`Task already being processed: ${taskId}`);
      return null;
    }

    await redis.sadd(this.TASK_PROCESSING_KEY, taskId);

    try {
      const taskQuery = `SELECT * FROM sync_queue WHERE id = $1 AND status = 'pending'`;
      const taskResult = await db.query(taskQuery, [taskId]);

      if (taskResult.rows.length === 0) {
        await redis.srem(this.TASK_PROCESSING_KEY, taskId);
        return null;
      }

      const task = taskResult.rows[0];
      
      await this.processTask(task);
      await redis.srem(this.TASK_PROCESSING_KEY, taskId);
      
      return task;
    } catch (error) {
      logger.error(`Error processing task ${taskId}:`, error);
      await redis.srem(this.TASK_PROCESSING_KEY, taskId);
      throw error;
    }
  }

  static async processTask(task) {
    const handler = this.handlers.get(task.operation_type);
    
    if (!handler) {
      const errorMessage = `No handler registered for task type: ${task.operation_type}`;
      logger.error(errorMessage);
      await this.markTaskFailed(task.id, errorMessage);
      return;
    }

    try {
      await db.query(`UPDATE sync_queue SET status = 'processing' WHERE id = $1`, [task.id]);
      
      const beforeData = null;
      const afterData = await handler(task.data, task.user_id);
      
      await db.query(`
        UPDATE sync_queue 
        SET status = 'completed', processed_at = CURRENT_TIMESTAMP 
        WHERE id = $1
      `, [task.id]);

      await AuditService.logOperation(
        task.user_id,
        'process_async_task',
        'sync_queue',
        task.id,
        beforeData,
        afterData,
        uuidv4(),
        null,
        null,
        null,
        'success'
      );

      logger.info(`Task completed: ${task.id}`);
    } catch (error) {
      logger.error(`Task failed: ${task.id}`, error);
      await this.handleTaskFailure(task, error);
    }
  }

  static async handleTaskFailure(task, error) {
    const retryCount = task.retry_count + 1;
    
    if (retryCount >= this.MAX_RETRIES) {
      await this.markTaskFailed(task.id, error.message);
      return;
    }

    const nextRetryAt = new Date(Date.now() + this.RETRY_DELAY_BASE * Math.pow(2, retryCount));
    
    await db.query(`
      UPDATE sync_queue 
      SET status = 'failed', retry_count = $1, next_retry_at = $2, error_message = $3
      WHERE id = $4
    `, [retryCount, nextRetryAt, error.message, task.id]);

    await redis.zadd(this.TASK_QUEUE_KEY, task.priority, task.id);
    
    logger.info(`Task ${task.id} scheduled for retry ${retryCount} at ${nextRetryAt}`);
  }

  static async markTaskFailed(taskId, errorMessage) {
    await db.query(`
      UPDATE sync_queue 
      SET status = 'failed_permanently', error_message = $1 
      WHERE id = $2
    `, [errorMessage, taskId]);
    
    logger.error(`Task ${taskId} failed permanently: ${errorMessage}`);
  }

  static async retryFailedTasks() {
    const query = `
      SELECT * FROM sync_queue 
      WHERE status = 'failed' AND next_retry_at <= CURRENT_TIMESTAMP
    `;
    
    const result = await db.query(query);
    
    for (const task of result.rows) {
      await redis.zadd(this.TASK_QUEUE_KEY, task.priority, task.id);
      logger.info(`Task ${task.id} re-enqueued for retry`);
    }
    
    return result.rows.length;
  }

  static async getTaskStatus(taskId) {
    const query = `SELECT * FROM sync_queue WHERE id = $1`;
    const result = await db.query(query, [taskId]);
    
    if (result.rows.length === 0) {
      throw new Error('Task not found');
    }
    
    return result.rows[0];
  }

  static async rollbackOperation(taskId) {
    const task = await this.getTaskStatus(taskId);
    
    if (task.status !== 'completed') {
      throw new Error('Can only rollback completed tasks');
    }

    const rollbackHandler = this.handlers.get(`${task.operation_type}_rollback`);
    
    if (!rollbackHandler) {
      throw new Error(`No rollback handler registered for task type: ${task.operation_type}`);
    }

    const client = await db.getClient();
    
    try {
      await client.query('BEGIN');
      
      const result = await rollbackHandler(task.data, task.user_id, client);
      
      await client.query(`
        UPDATE sync_queue 
        SET status = 'rolled_back'
        WHERE id = $1
      `, [taskId]);
      
      await client.query('COMMIT');
      
      logger.info(`Task ${taskId} rolled back successfully`);
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error(`Rollback failed for task ${taskId}:`, error);
      throw error;
    } finally {
      client.release();
    }
  }

  static async startProcessing(intervalMs = 1000) {
    const process = async () => {
      try {
        const task = await this.processNextTask();
        if (task) {
          logger.info(`Processed task: ${task.id}`);
        }
      } catch (error) {
        logger.error('Error in task processing loop:', error);
      }
    };

    setInterval(process, intervalMs);
    logger.info('Async task processor started');
  }
}

module.exports = AsyncTaskService;
