const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
const logger = require('../utils/logger');
const AuditService = require('./auditService');
const ConcurrencyService = require('./concurrencyService');
const AsyncTaskService = require('./asyncTaskService');

class InventoryService {
  static async createInventoryItem(itemData, userId, clientId, requestId, ipAddress, userAgent) {
    const client = await db.getClient();
    
    try {
      await client.query('BEGIN');
      
      const query = `
        INSERT INTO inventory_items (
          id, sku, name, description, category, unit,
          min_stock_level, max_stock_level, version
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 1)
        RETURNING *
      `;
      
      const values = [
        uuidv4(),
        itemData.sku,
        itemData.name,
        itemData.description,
        itemData.category,
        itemData.unit,
        itemData.min_stock_level || 0,
        itemData.max_stock_level || 0
      ];
      
      const result = await client.query(query, values);
      const newItem = result.rows[0];
      
      await AuditService.logOperation(
        userId,
        'CREATE',
        'inventory_items',
        newItem.id,
        null,
        newItem,
        requestId,
        clientId,
        ipAddress,
        userAgent,
        'success'
      );
      
      await client.query('COMMIT');
      
      await ConcurrencyService.invalidateCache('inventory_items:*');
      
      logger.info(`Inventory item created: ${newItem.id}`);
      return newItem;
    } catch (error) {
      await client.query('ROLLBACK');
      
      await AuditService.logOperation(
        userId,
        'CREATE',
        'inventory_items',
        null,
        null,
        itemData,
        requestId,
        clientId,
        ipAddress,
        userAgent,
        'failed',
        error.message
      );
      
      logger.error('Error creating inventory item:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  static async updateInventoryItem(itemId, updateData, expectedVersion, userId, clientId, requestId, ipAddress, userAgent) {
    const client = await db.getClient();
    
    try {
      await client.query('BEGIN');
      
      const beforeDataQuery = `SELECT * FROM inventory_items WHERE id = $1`;
      const beforeResult = await client.query(beforeDataQuery, [itemId]);
      
      if (beforeResult.rows.length === 0) {
        throw new Error('Inventory item not found');
      }
      
      const beforeData = beforeResult.rows[0];
      
      const updatedItem = await ConcurrencyService.updateWithOptimisticLocking(
        'inventory_items',
        itemId,
        updateData,
        expectedVersion,
        client
      );
      
      await AuditService.logOperation(
        userId,
        'UPDATE',
        'inventory_items',
        itemId,
        beforeData,
        updatedItem,
        requestId,
        clientId,
        ipAddress,
        userAgent,
        'success'
      );
      
      await client.query('COMMIT');
      
      await ConcurrencyService.invalidateCache(`inventory_items:${itemId}`);
      
      logger.info(`Inventory item updated: ${itemId}`);
      return updatedItem;
    } catch (error) {
      await client.query('ROLLBACK');
      
      await AuditService.logOperation(
        userId,
        'UPDATE',
        'inventory_items',
        itemId,
        null,
        updateData,
        requestId,
        clientId,
        ipAddress,
        userAgent,
        'failed',
        error.message
      );
      
      logger.error('Error updating inventory item:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  static async createInventoryTask(taskData, userId, clientId, requestId, ipAddress, userAgent) {
    const client = await db.getClient();
    
    try {
      await client.query('BEGIN');
      
      const query = `
        INSERT INTO inventory_tasks (
          id, warehouse_id, name, description, status, priority,
          created_by, assigned_to, scheduled_date, version
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 1)
        RETURNING *
      `;
      
      const values = [
        uuidv4(),
        taskData.warehouse_id,
        taskData.name,
        taskData.description,
        'pending',
        taskData.priority || 'normal',
        userId,
        taskData.assigned_to,
        taskData.scheduled_date
      ];
      
      const result = await client.query(query, values);
      const newTask = result.rows[0];
      
      if (taskData.items && taskData.items.length > 0) {
        for (const item of taskData.items) {
          const itemQuery = `
            INSERT INTO inventory_task_items (
              id, task_id, item_id, expected_quantity, status
            ) VALUES ($1, $2, $3, $4, 'pending')
          `;
          
          await client.query(itemQuery, [
            uuidv4(),
            newTask.id,
            item.item_id,
            item.expected_quantity
          ]);
        }
      }
      
      await AuditService.logOperation(
        userId,
        'CREATE',
        'inventory_tasks',
        newTask.id,
        null,
        newTask,
        requestId,
        clientId,
        ipAddress,
        userAgent,
        'success'
      );
      
      await client.query('COMMIT');
      
      logger.info(`Inventory task created: ${newTask.id}`);
      return newTask;
    } catch (error) {
      await client.query('ROLLBACK');
      
      logger.error('Error creating inventory task:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  static async updateInventoryCount(taskItemId, actualQuantity, notes, userId, clientId, requestId, ipAddress, userAgent) {
    const client = await db.getClient();
    
    try {
      await client.query('BEGIN');
      
      const beforeQuery = `
        SELECT iti.*, it.id as task_id, it.version as task_version
        FROM inventory_task_items iti
        JOIN inventory_tasks it ON iti.task_id = it.id
        WHERE iti.id = $1
        FOR UPDATE
      `;
      
      const beforeResult = await client.query(beforeQuery, [taskItemId]);
      
      if (beforeResult.rows.length === 0) {
        throw new Error('Task item not found');
      }
      
      const beforeData = beforeResult.rows[0];
      
      const updateQuery = `
        UPDATE inventory_task_items
        SET actual_quantity = $1,
            status = CASE WHEN $1 IS NOT NULL THEN 'completed' ELSE status END,
            notes = $2,
            counted_by = $3,
            counted_at = CURRENT_TIMESTAMP
        WHERE id = $4
        RETURNING *
      `;
      
      const result = await client.query(updateQuery, [
        actualQuantity,
        notes,
        userId,
        taskItemId
      ]);
      
      const updatedItem = result.rows[0];
      
      await AuditService.logOperation(
        userId,
        'UPDATE_COUNT',
        'inventory_task_items',
        taskItemId,
        beforeData,
        updatedItem,
        requestId,
        clientId,
        ipAddress,
        userAgent,
        'success'
      );
      
      await client.query('COMMIT');
      
      logger.info(`Inventory count updated: ${taskItemId}`);
      return updatedItem;
    } catch (error) {
      await client.query('ROLLBACK');
      
      logger.error('Error updating inventory count:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  static async completeInventoryTask(taskId, userId, clientId, requestId, ipAddress, userAgent) {
    const client = await db.getClient();
    
    try {
      await client.query('BEGIN');
      
      const beforeQuery = `
        SELECT * FROM inventory_tasks WHERE id = $1 FOR UPDATE
      `;
      
      const beforeResult = await client.query(beforeQuery, [taskId]);
      
      if (beforeResult.rows.length === 0) {
        throw new Error('Task not found');
      }
      
      const beforeData = beforeResult.rows[0];
      
      const itemsQuery = `
        SELECT COUNT(*) as total,
               COUNT(*) FILTER (WHERE status = 'completed') as completed
        FROM inventory_task_items
        WHERE task_id = $1
      `;
      
      const itemsResult = await client.query(itemsQuery, [taskId]);
      const { total, completed } = itemsResult.rows[0];
      
      if (parseInt(total) !== parseInt(completed)) {
        throw new Error(`Cannot complete task: ${completed}/${total} items counted`);
      }
      
      const updateQuery = `
        UPDATE inventory_tasks
        SET status = 'completed',
            completed_at = CURRENT_TIMESTAMP,
            end_time = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING *
      `;
      
      const result = await client.query(updateQuery, [taskId]);
      const updatedTask = result.rows[0];
      
      await AuditService.logOperation(
        userId,
        'COMPLETE',
        'inventory_tasks',
        taskId,
        beforeData,
        updatedTask,
        requestId,
        clientId,
        ipAddress,
        userAgent,
        'success'
      );
      
      await client.query('COMMIT');
      
      logger.info(`Inventory task completed: ${taskId}`);
      return updatedTask;
    } catch (error) {
      await client.query('ROLLBACK');
      
      logger.error('Error completing inventory task:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  static async getInventoryTaskDetails(taskId) {
    const cacheKey = `inventory_tasks:${taskId}`;
    const cached = await ConcurrencyService.getFromCache(cacheKey);
    
    if (cached) {
      return cached;
    }
    
    const query = `
      SELECT 
        it.*,
        w.name as warehouse_name,
        json_agg(
          json_build_object(
            'id', iti.id,
            'item_id', iti.item_id,
            'sku', ii.sku,
            'item_name', ii.name,
            'expected_quantity', iti.expected_quantity,
            'actual_quantity', iti.actual_quantity,
            'difference', iti.difference,
            'status', iti.status,
            'notes', iti.notes
          )
        ) as items
      FROM inventory_tasks it
      JOIN warehouses w ON it.warehouse_id = w.id
      LEFT JOIN inventory_task_items iti ON it.id = iti.task_id
      LEFT JOIN inventory_items ii ON iti.item_id = ii.id
      WHERE it.id = $1
      GROUP BY it.id, w.name
    `;
    
    const result = await db.query(query, [taskId]);
    
    if (result.rows.length === 0) {
      throw new Error('Task not found');
    }
    
    const taskData = result.rows[0];
    await ConcurrencyService.setInCache(cacheKey, taskData, 300);
    
    return taskData;
  }

  static async syncOfflineOperations(operations, userId, clientId, requestId, ipAddress, userAgent) {
    const results = [];
    
    for (const operation of operations) {
      try {
        const operationRequestId = operation.request_id || operation.requestId;
        
        const duplicateCheck = await ConcurrencyService.checkDuplicateRequest(
          operationRequestId,
          userId
        );
        
        if (duplicateCheck.isDuplicate) {
          results.push({
            operation_id: operationRequestId,
            status: 'duplicate',
            data: duplicateCheck.data
          });
          continue;
        }
        
        let result;
        switch (operation.type) {
          case 'update_count':
            result = await this.updateInventoryCount(
              operation.data.task_item_id,
              operation.data.actual_quantity,
              operation.data.notes,
              userId,
              clientId,
              operationRequestId,
              ipAddress,
              userAgent
            );
            break;
          case 'complete_task':
            result = await this.completeInventoryTask(
              operation.data.task_id,
              userId,
              clientId,
              operationRequestId,
              ipAddress,
              userAgent
            );
            break;
          default:
            throw new Error(`Unknown operation type: ${operation.type}`);
        }
        
        await ConcurrencyService.cacheRequestResult(
          operationRequestId,
          userId,
          result
        );
        
        results.push({
          operation_id: operationRequestId,
          status: 'success',
          data: result
        });
      } catch (error) {
        const operationRequestId = operation.request_id || operation.requestId;
        logger.error(`Error syncing operation ${operationRequestId}:`, error);
        
        await AsyncTaskService.enqueueTask(
          operation.type,
          operation.data,
          userId,
          1
        );
        
        results.push({
          operation_id: operationRequestId,
          status: 'queued',
          error: error.message
        });
      }
    }
    
    return results;
  }
}

module.exports = InventoryService;
