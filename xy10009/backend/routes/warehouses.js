const express = require('express');
const { Warehouse } = require('../models');
const { requireLogin, requireAdmin } = require('../middleware/auth');
const historyService = require('../services/historyService');
const { withOptimisticLock } = require('../utils/optimisticLock');

const router = express.Router();

router.get('/', requireLogin, async (req, res, next) => {
  try {
    const warehouses = await Warehouse.findAll({
      where: { isActive: true },
      order: [['createdAt', 'DESC']]
    });

    res.json({
      success: true,
      data: warehouses
    });
  } catch (error) {
    next(error);
  }
});

router.get('/:id', requireLogin, async (req, res, next) => {
  try {
    const warehouse = await Warehouse.findByPk(req.params.id);

    if (!warehouse) {
      return res.status(404).json({
        success: false,
        message: '仓库不存在'
      });
    }

    res.json({
      success: true,
      data: warehouse
    });
  } catch (error) {
    next(error);
  }
});

router.post('/', requireLogin, requireAdmin, async (req, res, next) => {
  try {
    const warehouse = await Warehouse.create(req.body);

    await historyService.logCreate(warehouse, req.user, req);

    res.status(201).json({
      success: true,
      data: warehouse
    });
  } catch (error) {
    next(error);
  }
});

router.put('/:id', requireLogin, requireAdmin, async (req, res, next) => {
  try {
    const warehouse = await Warehouse.findByPk(req.params.id);

    if (!warehouse) {
      return res.status(404).json({
        success: false,
        message: '仓库不存在'
      });
    }

    const oldWarehouse = { ...warehouse.toJSON() };
    const updatedWarehouse = await withOptimisticLock(
      Warehouse,
      req.params.id,
      { ...req.body, version: req.body.version },
      req.user
    );

    await historyService.logUpdate(oldWarehouse, updatedWarehouse, req.user, req);

    res.json({
      success: true,
      data: updatedWarehouse
    });
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', requireLogin, requireAdmin, async (req, res, next) => {
  try {
    const warehouse = await Warehouse.findByPk(req.params.id);

    if (!warehouse) {
      return res.status(404).json({
        success: false,
        message: '仓库不存在'
      });
    }

    await historyService.logDelete(warehouse, req.user, req);

    await warehouse.update({ isActive: false });

    res.json({
      success: true,
      message: '删除成功'
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;