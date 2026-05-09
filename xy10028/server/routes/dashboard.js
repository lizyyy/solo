const express = require('express');
const { authMiddleware } = require('./auth');
const db = require('../models');

const router = express.Router();

router.use(authMiddleware);

router.get('/stats', async (req, res, next) => {
  try {
    const { storeId } = req.query;
    const where = {};
    if (storeId) where.storeId = storeId;

    const totalInventory = await db.Inventory.sum('quantity', { where });
    const totalItems = await db.Inventory.count({ where });

    const lowStockCount = await db.Inventory.count({
      where: {
        ...where,
        quantity: { [db.Sequelize.Op.lte]: db.Sequelize.col('minStock') }
      }
    });

    const totalValue = await db.Inventory.findAll({
      where,
      attributes: [[db.sequelize.fn('SUM', db.sequelize.literal('quantity * price')), 'total']]
    });

    const todayOperations = await db.OperationLog.count({
      where: {
        operationAt: {
          [db.Sequelize.Op.gte]: new Date(new Date().setHours(0, 0, 0, 0))
        }
      }
    });

    const pendingTransfers = await db.TransferOrder.count({
      where: { status: 'PENDING' }
    });

    res.json({
      success: true,
      data: {
        totalInventory: totalInventory || 0,
        totalItems,
        lowStockCount,
        totalValue: Number(totalValue[0]?.getDataValue('total')) || 0,
        todayOperations,
        pendingTransfers
      }
    });
  } catch (error) {
    next(error);
  }
});

router.get('/recent-operations', async (req, res, next) => {
  try {
    const { limit = 10 } = req.query;

    const operations = await db.OperationLog.findAll({
      include: [
        { model: db.User, attributes: ['name'] },
        { model: db.Inventory, include: [{ model: db.Product }, { model: db.Store }] }
      ],
      order: [['sequence', 'DESC']],
      limit: parseInt(limit)
    });

    res.json({
      success: true,
      data: operations.map(log => ({
        ...log.toJSON(),
        beforeState: JSON.parse(log.beforeState),
        afterState: JSON.parse(log.afterState),
        changeDetails: JSON.parse(log.changeDetails)
      }))
    });
  } catch (error) {
    next(error);
  }
});

router.get('/low-stock-alerts', async (req, res, next) => {
  try {
    const { storeId, limit = 20 } = req.query;
    const where = {};
    if (storeId) where.storeId = storeId;

    where.quantity = { [db.Sequelize.Op.lte]: db.Sequelize.col('minStock') };

    const lowStockItems = await db.Inventory.findAll({
      where,
      include: [{ model: db.Product }, { model: db.Store }],
      order: [['quantity', 'ASC']],
      limit: parseInt(limit)
    });

    res.json({
      success: true,
      data: lowStockItems
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
