const db = require('../config/database');
const logger = require('../utils/logger');
const AuditService = require('./auditService');
const { v4: uuidv4 } = require('uuid');

class RollbackService {
  static async rollbackInventoryTask(taskId, userId, clientId, requestId, ipAddress, userAgent) {
    const client = await db.getClient();
    
    try {
      await client.query('BEGIN');
      
      const taskQuery = `SELECT * FROM inventory_tasks WHERE id = $1`;
      const taskResult = await client.query(taskQuery, [taskId]);
      
      if (taskResult.rows.length === 0) {
        throw new Error('Task not found');
      }
      
      const task = taskResult.rows[0];
      
      const beforeData = {
        task,
        items: []
      };
      
      const itemsQuery = `
        SELECT iti.*, ii.name as item_name, ii.sku
        FROM inventory_task_items iti
        JOIN inventory_items ii ON iti.item_id = ii.id
        WHERE iti.task_id = $1
      `;
      const itemsResult = await client.query(itemsQuery, [taskId]);
      
      for (const item of itemsResult.rows) {
        beforeData.items.push({ ...item });
      }
      
      const updateTaskQuery = `
        UPDATE inventory_tasks
        SET status = 'in_progress',
            completed_at = NULL,
            end_time = NULL
        WHERE id = $1
        RETURNING *
      `;
      const updatedTaskResult = await client.query(updateTaskQuery, [taskId]);
      const updatedTask = updatedTaskResult.rows[0];
      
      const updateItemsQuery = `
        UPDATE inventory_task_items
        SET actual_quantity = NULL,
            status = 'pending',
            notes = NULL,
            counted_by = NULL,
            counted_at = NULL
        WHERE task_id = $1
        RETURNING *
      `;
      const updatedItemsResult = await client.query(updateItemsQuery, [taskId]);
      
      const afterData = {
        task: updatedTask,
        items: updatedItemsResult.rows
      };
      
      await AuditService.logOperation(
        userId,
        'ROLLBACK_TASK',
        'inventory_tasks',
        taskId,
        beforeData,
        afterData,
        requestId,
        clientId,
        ipAddress,
        userAgent,
        'success'
      );
      
      await client.query('COMMIT');
      
      logger.info(`Task ${taskId} rolled back successfully by user ${userId}`);
      
      return {
        success: true,
        message: `任务 ${task.name} 已回滚到可编辑状态`,
        task: updatedTask,
        itemsCount: updatedItemsResult.rows.length
      };
    } catch (error) {
      await client.query('ROLLBACK');
      
      await AuditService.logOperation(
        userId,
        'ROLLBACK_TASK',
        'inventory_tasks',
        taskId,
        null,
        null,
        requestId,
        clientId,
        ipAddress,
        userAgent,
        'failed',
        error.message
      );
      
      logger.error(`Failed to rollback task ${taskId}:`, error);
      throw error;
    } finally {
      client.release();
    }
  }

  static async rollbackTaskItem(taskItemId, userId, clientId, requestId, ipAddress, userAgent) {
    const client = await db.getClient();
    
    try {
      await client.query('BEGIN');
      
      const itemQuery = `
        SELECT iti.*, ii.name as item_name, ii.sku, it.id as task_id
        FROM inventory_task_items iti
        JOIN inventory_items ii ON iti.item_id = ii.id
        JOIN inventory_tasks it ON iti.task_id = it.id
        WHERE iti.id = $1
      `;
      const itemResult = await client.query(itemQuery, [taskItemId]);
      
      if (itemResult.rows.length === 0) {
        throw new Error('Task item not found');
      }
      
      const item = itemResult.rows[0];
      
      const beforeData = { ...item };
      
      const updateQuery = `
        UPDATE inventory_task_items
        SET actual_quantity = NULL,
            status = 'pending',
            notes = NULL,
            counted_by = NULL,
            counted_at = NULL
        WHERE id = $1
        RETURNING *
      `;
      const updateResult = await client.query(updateQuery, [taskItemId]);
      const updatedItem = updateResult.rows[0];
      
      const afterData = { ...updatedItem };
      
      await AuditService.logOperation(
        userId,
        'ROLLBACK_ITEM',
        'inventory_task_items',
        taskItemId,
        beforeData,
        afterData,
        requestId,
        clientId,
        ipAddress,
        userAgent,
        'success'
      );
      
      await client.query('COMMIT');
      
      logger.info(`Task item ${taskItemId} rolled back successfully by user ${userId}`);
      
      return {
        success: true,
        message: `商品 ${item.sku} - ${item.item_name} 已回滚到待盘点状态`,
        item: updatedItem
      };
    } catch (error) {
      await client.query('ROLLBACK');
      
      await AuditService.logOperation(
        userId,
        'ROLLBACK_ITEM',
        'inventory_task_items',
        taskItemId,
        null,
        null,
        requestId,
        clientId,
        ipAddress,
        userAgent,
        'failed',
        error.message
      );
      
      logger.error(`Failed to rollback task item ${taskItemId}:`, error);
      throw error;
    } finally {
      client.release();
    }
  }

  static async rollbackOperationByLog(logId, userId, clientId, requestId, ipAddress, userAgent) {
    const logQuery = `SELECT * FROM operation_logs WHERE id = $1`;
    const logResult = await db.query(logQuery, [logId]);
    
    if (logResult.rows.length === 0) {
      throw new Error('Operation log not found');
    }
    
    const log = logResult.rows[0];
    
    if (!log.before_data) {
      throw new Error('Cannot rollback: no before_data available in log');
    }
    
    const client = await db.getClient();
    
    try {
      await client.query('BEGIN');
      
      let result;
      
      switch (log.resource_type) {
        case 'inventory_task_items':
          result = await this.rollbackTaskItemFromLog(log, client, userId);
          break;
        case 'inventory_tasks':
          result = await this.rollbackTaskFromLog(log, client, userId);
          break;
        case 'inventory_items':
          result = await this.rollbackInventoryItemFromLog(log, client, userId);
          break;
        default:
          throw new Error(`Cannot rollback resource type: ${log.resource_type}`);
      }
      
      await AuditService.logOperation(
        userId,
        'ROLLBACK_FROM_LOG',
        log.resource_type,
        log.resource_id,
        { originalLogId: logId, logBeforeData: log.before_data },
        result,
        requestId,
        clientId,
        ipAddress,
        userAgent,
        'success'
      );
      
      await client.query('COMMIT');
      
      logger.info(`Operation ${logId} rolled back successfully by user ${userId}`);
      
      return {
        success: true,
        message: `操作已回滚`,
        originalOperation: log.operation_type,
        resourceType: log.resource_type,
        result
      };
    } catch (error) {
      await client.query('ROLLBACK');
      
      await AuditService.logOperation(
        userId,
        'ROLLBACK_FROM_LOG',
        log.resource_type,
        log.resource_id,
        { originalLogId: logId },
        null,
        requestId,
        clientId,
        ipAddress,
        userAgent,
        'failed',
        error.message
      );
      
      logger.error(`Failed to rollback operation ${logId}:`, error);
      throw error;
    } finally {
      client.release();
    }
  }

  static async rollbackTaskItemFromLog(log, client, userId) {
    const beforeData = log.before_data;
    
    if (!beforeData || !beforeData.id) {
      throw new Error('Invalid before_data for task item rollback');
    }
    
    const updateQuery = `
      UPDATE inventory_task_items
      SET actual_quantity = $1,
          status = $2,
          notes = $3,
          counted_by = $4,
          counted_at = $5
      WHERE id = $6
      RETURNING *
    `;
    
    const values = [
      beforeData.actual_quantity,
      beforeData.status || 'pending',
      beforeData.notes,
      beforeData.counted_by,
      beforeData.counted_at,
      beforeData.id
    ];
    
    const result = await client.query(updateQuery, values);
    return result.rows[0];
  }

  static async rollbackTaskFromLog(log, client, userId) {
    const beforeData = log.before_data;
    
    if (!beforeData || !beforeData.id) {
      throw new Error('Invalid before_data for task rollback');
    }
    
    const updateQuery = `
      UPDATE inventory_tasks
      SET status = $1,
          start_time = $2,
          end_time = $3,
          completed_at = $4
      WHERE id = $5
      RETURNING *
    `;
    
    const values = [
      beforeData.status || 'pending',
      beforeData.start_time,
      beforeData.end_time,
      beforeData.completed_at,
      beforeData.id
    ];
    
    const result = await client.query(updateQuery, values);
    return result.rows[0];
  }

  static async rollbackInventoryItemFromLog(log, client, userId) {
    const beforeData = log.before_data;
    
    if (!beforeData || !beforeData.id) {
      throw new Error('Invalid before_data for inventory item rollback');
    }
    
    const updateQuery = `
      UPDATE inventory_items
      SET sku = $1,
          name = $2,
          description = $3,
          category = $4,
          unit = $5,
          min_stock_level = $6,
          max_stock_level = $7
      WHERE id = $8
      RETURNING *
    `;
    
    const values = [
      beforeData.sku,
      beforeData.name,
      beforeData.description,
      beforeData.category,
      beforeData.unit,
      beforeData.min_stock_level,
      beforeData.max_stock_level,
      beforeData.id
    ];
    
    const result = await client.query(updateQuery, values);
    return result.rows[0];
  }

  static async getRollbackHistory(taskId) {
    const query = `
      SELECT * FROM operation_logs
      WHERE (resource_type = 'inventory_tasks' AND resource_id = $1)
         OR (resource_type = 'inventory_task_items' AND resource_id IN (
             SELECT id FROM inventory_task_items WHERE task_id = $1
         ))
         OR operation_type LIKE '%ROLLBACK%'
      ORDER BY timestamp DESC
      LIMIT 100
    `;
    
    const result = await db.query(query, [taskId]);
    return result.rows;
  }

  static async getAvailableRollbacks(taskId) {
    const query = `
      SELECT ol.*
      FROM operation_logs ol
      WHERE ol.resource_type = 'inventory_task_items'
        AND ol.resource_id IN (SELECT id FROM inventory_task_items WHERE task_id = $1)
        AND ol.operation_type = 'UPDATE_COUNT'
        AND ol.before_data IS NOT NULL
        AND ol.status = 'success'
      ORDER BY ol.timestamp DESC
    `;
    
    const result = await db.query(query, [taskId]);
    return result.rows;
  }
}

module.exports = RollbackService;
