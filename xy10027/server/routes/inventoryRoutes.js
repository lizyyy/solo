const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
const InventoryService = require('../services/inventoryService');
const AuditService = require('../services/auditService');
const ReportService = require('../services/reportService');
const ConcurrencyService = require('../services/concurrencyService');
const AsyncTaskService = require('../services/asyncTaskService');
const authMiddleware = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

router.use(authMiddleware);

router.post('/items', async (req, res) => {
  try {
    const duplicateCheck = await ConcurrencyService.checkDuplicateRequest(
      req.requestId,
      req.userId
    );
    
    if (duplicateCheck.isDuplicate) {
      return res.status(200).json({
        ...duplicateCheck.data,
        isDuplicate: true,
        requestId: req.requestId
      });
    }
    
    const item = await InventoryService.createInventoryItem(
      req.body,
      req.userId,
      req.clientId,
      req.requestId,
      req.ip,
      req.get('User-Agent')
    );
    
    await ConcurrencyService.cacheRequestResult(req.requestId, req.userId, item);
    
    res.status(201).json({
      ...item,
      requestId: req.requestId
    });
  } catch (error) {
    logger.error('Error creating inventory item:', error);
    res.status(500).json({
      error: error.message,
      requestId: req.requestId
    });
  }
});

router.put('/items/:id', async (req, res) => {
  try {
    const { version, ...updateData } = req.body;
    
    const item = await InventoryService.updateInventoryItem(
      req.params.id,
      updateData,
      version,
      req.userId,
      req.clientId,
      req.requestId,
      req.ip,
      req.get('User-Agent')
    );
    
    res.status(200).json({
      ...item,
      requestId: req.requestId
    });
  } catch (error) {
    if (error.message.includes('Optimistic locking')) {
      return res.status(409).json({
        error: 'Resource has been modified by another user',
        requestId: req.requestId
      });
    }
    logger.error('Error updating inventory item:', error);
    res.status(500).json({
      error: error.message,
      requestId: req.requestId
    });
  }
});

router.get('/tasks', async (req, res) => {
  try {
    const query = `
      SELECT 
        it.*,
        w.name as warehouse_name
      FROM inventory_tasks it
      JOIN warehouses w ON it.warehouse_id = w.id
      ORDER BY it.created_at DESC
      LIMIT 100
    `;
    
    const result = await db.query(query);
    
    res.status(200).json({
      tasks: result.rows,
      requestId: req.requestId
    });
  } catch (error) {
    logger.error('Error getting tasks:', error);
    res.status(500).json({
      error: error.message,
      requestId: req.requestId
    });
  }
});

router.post('/tasks', async (req, res) => {
  try {
    const task = await InventoryService.createInventoryTask(
      req.body,
      req.userId,
      req.clientId,
      req.requestId,
      req.ip,
      req.get('User-Agent')
    );
    
    res.status(201).json({
      ...task,
      requestId: req.requestId
    });
  } catch (error) {
    logger.error('Error creating inventory task:', error);
    res.status(500).json({
      error: error.message,
      requestId: req.requestId
    });
  }
});

router.put('/tasks/:taskId/items/:itemId/count', async (req, res) => {
  try {
    const { actual_quantity, notes } = req.body;
    
    const item = await InventoryService.updateInventoryCount(
      req.params.itemId,
      actual_quantity,
      notes,
      req.userId,
      req.clientId,
      req.requestId,
      req.ip,
      req.get('User-Agent')
    );
    
    res.status(200).json({
      ...item,
      requestId: req.requestId
    });
  } catch (error) {
    logger.error('Error updating count:', error);
    res.status(500).json({
      error: error.message,
      requestId: req.requestId
    });
  }
});

router.post('/tasks/:taskId/complete', async (req, res) => {
  try {
    const task = await InventoryService.completeInventoryTask(
      req.params.taskId,
      req.userId,
      req.clientId,
      req.requestId,
      req.ip,
      req.get('User-Agent')
    );
    
    res.status(200).json({
      ...task,
      requestId: req.requestId
    });
  } catch (error) {
    logger.error('Error completing task:', error);
    res.status(500).json({
      error: error.message,
      requestId: req.requestId
    });
  }
});

router.get('/tasks/:taskId', async (req, res) => {
  try {
    const task = await InventoryService.getInventoryTaskDetails(req.params.taskId);
    
    res.status(200).json({
      ...task,
      requestId: req.requestId
    });
  } catch (error) {
    logger.error('Error getting task details:', error);
    res.status(404).json({
      error: error.message,
      requestId: req.requestId
    });
  }
});

router.post('/sync', async (req, res) => {
  try {
    const { operations } = req.body;
    
    const results = await InventoryService.syncOfflineOperations(
      operations,
      req.userId,
      req.clientId,
      req.requestId,
      req.ip,
      req.get('User-Agent')
    );
    
    res.status(200).json({
      results,
      requestId: req.requestId
    });
  } catch (error) {
    logger.error('Error syncing operations:', error);
    res.status(500).json({
      error: error.message,
      requestId: req.requestId
    });
  }
});

router.get('/audit/:resourceType/:resourceId', async (req, res) => {
  try {
    const { resourceType, resourceId } = req.params;
    const limit = parseInt(req.query.limit) || 100;
    
    const history = await AuditService.getOperationHistory(resourceType, resourceId, limit);
    
    res.status(200).json({
      history,
      requestId: req.requestId
    });
  } catch (error) {
    logger.error('Error getting audit history:', error);
    res.status(500).json({
      error: error.message,
      requestId: req.requestId
    });
  }
});

router.get('/report/:taskId', async (req, res) => {
  try {
    const { taskId } = req.params;
    const format = req.query.format || 'excel';
    
    const report = await ReportService.generateInventoryReport(taskId, format);
    
    res.setHeader('Content-Type', report.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${report.filename}"`);
    
    if (report.buffer) {
      res.send(report.buffer);
    } else if (report.content) {
      res.send(report.content);
    }
  } catch (error) {
    logger.error('Error generating report:', error);
    res.status(500).json({
      error: error.message,
      requestId: req.requestId
    });
  }
});

module.exports = router;
