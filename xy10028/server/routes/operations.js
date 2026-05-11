const express = require('express');
const { authMiddleware } = require('./auth');
const auditService = require('../services/auditService');
const db = require('../models');

const router = express.Router();

router.use(authMiddleware);

router.get('/', async (req, res, next) => {
  try {
    const { startDate, endDate, operationType, status, page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;

    if (!startDate || !endDate) {
      return res.status(400).json({ success: false, message: '请提供开始和结束日期' });
    }

    const result = await auditService.getLogsByDateRange(
      new Date(startDate),
      new Date(endDate),
      {
        operationType,
        status,
        limit: parseInt(limit),
        offset
      }
    );

    res.json({
      success: true,
      data: {
        rows: result.rows.map(log => ({
          ...log.toJSON(),
          beforeState: JSON.parse(log.beforeState),
          afterState: JSON.parse(log.afterState),
          changeDetails: JSON.parse(log.changeDetails)
        })),
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: result.count
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

router.get('/inventory/:inventoryId', async (req, res, next) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;

    const result = await auditService.getLogsByInventory(req.params.inventoryId, {
      limit: parseInt(limit),
      offset
    });

    res.json({
      success: true,
      data: {
        rows: result.rows.map(log => ({
          ...log.toJSON(),
          beforeState: JSON.parse(log.beforeState),
          afterState: JSON.parse(log.afterState),
          changeDetails: JSON.parse(log.changeDetails)
        })),
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: result.count
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

router.get('/transfers', async (req, res, next) => {
  try {
    const { status, page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;

    const where = {};
    if (status) where.status = status;

    const result = await db.TransferOrder.findAndCountAll({
      where,
      include: [
        { model: db.Product },
        { model: db.Store, as: 'OutgoingTransfers' },
        { model: db.Store, as: 'IncomingTransfers' }
      ],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset
    });

    res.json({
      success: true,
      data: {
        rows: result.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: result.count
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

router.get('/price-changes', async (req, res, next) => {
  try {
    const { inventoryId, page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;

    const where = {};
    if (inventoryId) where.inventoryId = inventoryId;

    const result = await db.PriceChangeRecord.findAndCountAll({
      where,
      include: [
        {
          model: db.Inventory,
          include: [{ model: db.Product }, { model: db.Store }]
        },
        { model: db.User, attributes: ['id', 'name'] }
      ],
      order: [['effectiveFrom', 'DESC']],
      limit: parseInt(limit),
      offset
    });

    res.json({
      success: true,
      data: {
        rows: result.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: result.count
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const log = await auditService.getOperationById(req.params.id);

    if (!log) {
      return res.status(404).json({ success: false, message: '操作记录不存在' });
    }

    res.json({
      success: true,
      data: {
        ...log.toJSON(),
        beforeState: JSON.parse(log.beforeState),
        afterState: JSON.parse(log.afterState),
        changeDetails: JSON.parse(log.changeDetails)
      }
    });
  } catch (error) {
    next(error);
  }
});

router.get('/:id/replay', async (req, res, next) => {
  try {
    const replayInfo = await auditService.replayOperation(req.params.id);

    res.json({
      success: true,
      data: {
        ...replayInfo,
        log: replayInfo.log.toJSON()
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
