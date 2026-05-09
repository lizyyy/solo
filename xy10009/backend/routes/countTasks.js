const express = require('express');
const { Sequelize, Op } = require('sequelize');
const { 
  CountTask, 
  CountDetail, 
  Product, 
  Inventory, 
  Warehouse,
  User
} = require('../models');
const { requireLogin, requireAdmin } = require('../middleware/auth');
const historyService = require('../services/historyService');
const { withOptimisticLock, OptimisticLockError } = require('../utils/optimisticLock');

const router = express.Router();

function generateTaskNo() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `PD${year}${month}${day}${random}`;
}

router.get('/', requireLogin, async (req, res, next) => {
  try {
    const { page = 1, pageSize = 20, status, warehouseId, keyword } = req.query;
    const offset = (page - 1) * pageSize;

    const where = {};

    if (status) {
      where.status = status;
    }

    if (warehouseId) {
      where.warehouseId = warehouseId;
    }

    if (keyword) {
      where[Op.or] = [
        { name: { [Op.like]: `%${keyword}%` } },
        { taskNo: { [Op.like]: `%${keyword}%` } }
      ];
    }

    const { rows: tasks, count } = await CountTask.findAndCountAll({
      where,
      include: [
        { model: Warehouse, attributes: ['id', 'name'] },
        { model: User, as: 'creator', attributes: ['id', 'fullName'] }
      ],
      order: [['createdAt', 'DESC']],
      limit: parseInt(pageSize),
      offset: parseInt(offset)
    });

    res.json({
      success: true,
      data: {
        tasks,
        pagination: {
          page: parseInt(page),
          pageSize: parseInt(pageSize),
          total: count
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

router.get('/:id', requireLogin, async (req, res, next) => {
  try {
    const task = await CountTask.findByPk(req.params.id, {
      include: [
        { model: Warehouse, attributes: ['id', 'name'] },
        { model: User, as: 'creator', attributes: ['id', 'fullName'] },
        { 
          model: CountDetail,
          include: [
            { model: Product },
            { model: User, as: 'counter', attributes: ['id', 'fullName'] }
          ]
        }
      ]
    });

    if (!task) {
      return res.status(404).json({
        success: false,
        message: '盘点任务不存在'
      });
    }

    res.json({
      success: true,
      data: task
    });
  } catch (error) {
    next(error);
  }
});

router.post('/', requireLogin, requireAdmin, async (req, res, next) => {
  const transaction = await CountTask.sequelize.transaction();

  try {
    const { name, warehouseId, productIds, remark } = req.body;

    if (!name || !warehouseId) {
      return res.status(400).json({
        success: false,
        message: '任务名称和仓库不能为空'
      });
    }

    const task = await CountTask.create({
      taskNo: generateTaskNo(),
      name,
      warehouseId,
      createdBy: req.user.id,
      status: 'draft',
      remark
    }, { transaction });

    let productsToCount = [];

    if (productIds && productIds.length > 0) {
      productsToCount = await Product.findAll({
        where: { id: productIds, isActive: true }
      });
    } else {
      productsToCount = await Product.findAll({
        where: { isActive: true }
      });
    }

    const details = [];

    for (const product of productsToCount) {
      const inventory = await Inventory.findOne({
        where: { warehouseId, productId: product.id }
      });

      details.push({
        taskId: task.id,
        productId: product.id,
        inventoryId: inventory ? inventory.id : null,
        systemQuantity: inventory ? inventory.quantity : 0,
        countQuantity: 0,
        differenceQuantity: inventory ? -inventory.quantity : 0,
        countStatus: 'pending'
      });
    }

    await CountDetail.bulkCreate(details, { transaction });

    await transaction.commit();

    await historyService.logCreate(task, req.user, req);

    const result = await CountTask.findByPk(task.id, {
      include: [
        { model: Warehouse, attributes: ['id', 'name'] },
        { 
          model: CountDetail,
          include: [{ model: Product }]
        }
      ]
    });

    res.status(201).json({
      success: true,
      data: result
    });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
});

router.put('/:id/start', requireLogin, async (req, res, next) => {
  const transaction = await CountTask.sequelize.transaction();

  try {
    const task = await CountTask.findByPk(req.params.id);

    if (!task) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: '盘点任务不存在'
      });
    }

    if (task.status !== 'draft') {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: '只有草稿状态的任务才能开始'
      });
    }

    const oldTask = { ...task.toJSON() };

    await task.update({
      status: 'in_progress',
      startDate: new Date(),
      version: task.version + 1
    }, { transaction });

    await transaction.commit();

    await historyService.logAction('submit', task, req.user, req, '开始盘点');

    res.json({
      success: true,
      data: task
    });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
});

router.post('/sync-details', requireLogin, async (req, res, next) => {
  const transaction = await CountTask.sequelize.transaction();

  try {
    const { details } = req.body;

    if (!details || details.length === 0) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: '同步数据不能为空'
      });
    }

    const results = [];

    for (const item of details) {
      const detail = await CountDetail.findByPk(item.id, { transaction });

      if (!detail) {
        results.push({
          id: item.id,
          success: false,
          message: '盘点明细不存在'
        });
        continue;
      }

      if (detail.version > item.version) {
        results.push({
          id: item.id,
          success: false,
          message: '数据已过期，请刷新后重试',
          currentVersion: detail.version,
          providedVersion: item.version
        });
        continue;
      }

      const oldDetail = { ...detail.toJSON() };
      const countQuantity = parseFloat(item.countQuantity) || 0;
      const differenceQuantity = countQuantity - parseFloat(detail.systemQuantity);

      await detail.update({
        countQuantity,
        differenceQuantity,
        countStatus: 'counted',
        countedBy: req.user.id,
        countedAt: new Date(),
        remark: item.remark || null,
        version: detail.version + 1
      }, { transaction });

      await historyService.logUpdate(oldDetail, detail, req.user, req, '同步盘点数据');

      results.push({
        id: item.id,
        success: true,
        version: detail.version
      });
    }

    await transaction.commit();

    res.json({
      success: true,
      data: {
        results
      }
    });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
});

router.put('/details/:id', requireLogin, async (req, res, next) => {
  const transaction = await CountDetail.sequelize.transaction();

  try {
    const detail = await CountDetail.findByPk(req.params.id, {
      include: [{ model: CountTask }]
    });

    if (!detail) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: '盘点明细不存在'
      });
    }

    if (detail.CountTask && detail.CountTask.status !== 'in_progress') {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: '只能在盘点进行中更新明细'
      });
    }

    const currentVersion = detail.version;
    const providedVersion = req.body.version || currentVersion;

    if (currentVersion !== providedVersion) {
      await transaction.rollback();
      throw new OptimisticLockError(
        '数据已被其他用户修改，当前版本号：' + currentVersion + '，您的版本号：' + providedVersion,
        currentVersion,
        providedVersion
      );
    }

    const oldDetail = { ...detail.toJSON() };
    const countQuantity = parseFloat(req.body.countQuantity) || 0;
    const differenceQuantity = countQuantity - parseFloat(detail.systemQuantity);

    await detail.update({
      countQuantity,
      differenceQuantity,
      countStatus: 'counted',
      countedBy: req.user.id,
      countedAt: new Date(),
      remark: req.body.remark || null,
      version: detail.version + 1
    }, { transaction });

    await transaction.commit();

    await historyService.logUpdate(oldDetail, detail, req.user, req, '更新盘点明细');

    res.json({
      success: true,
      data: detail
    });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
});

router.put('/:id/complete', requireLogin, async (req, res, next) => {
  const transaction = await CountTask.sequelize.transaction();

  try {
    const task = await CountTask.findByPk(req.params.id, {
      include: [{ model: CountDetail }]
    });

    if (!task) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: '盘点任务不存在'
      });
    }

    if (task.status !== 'in_progress') {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: '只有进行中的任务才能完成'
      });
    }

    const currentVersion = task.version;
    const providedVersion = req.body.version || currentVersion;

    if (currentVersion !== providedVersion) {
      await transaction.rollback();
      throw new OptimisticLockError(
        '任务状态已被改变，请刷新后重试',
        currentVersion,
        providedVersion
      );
    }

    const pendingCount = task.CountDetails.filter(d => d.countStatus === 'pending').length;
    if (pendingCount > 0) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: `还有 ${pendingCount} 个商品未盘点，请完成所有盘点后再提交`
      });
    }

    await task.update({
      status: 'completed',
      endDate: new Date(),
      completedBy: req.user.id,
      version: task.version + 1
    }, { transaction });

    for (const detail of task.CountDetails) {
      if (detail.inventoryId) {
        const inventory = await Inventory.findByPk(detail.inventoryId);
        if (inventory) {
          const oldInventory = { ...inventory.toJSON() };
          await inventory.update({
            quantity: detail.countQuantity,
            version: inventory.version + 1
          }, { transaction });
          await historyService.logUpdate(oldInventory, inventory, req.user, req, `盘点调整：任务 ${task.taskNo}`);
        }
      } else {
        const newInventory = await Inventory.create({
          warehouseId: task.warehouseId,
          productId: detail.productId,
          quantity: detail.countQuantity,
          version: 1
        }, { transaction });
        await historyService.logCreate(newInventory, req.user, req);
      }
    }

    await transaction.commit();

    await historyService.logAction('complete', task, req.user, req, '完成盘点');

    res.json({
      success: true,
      data: task
    });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
});

router.put('/:id/cancel', requireLogin, async (req, res, next) => {
  try {
    const task = await CountTask.findByPk(req.params.id);

    if (!task) {
      return res.status(404).json({
        success: false,
        message: '盘点任务不存在'
      });
    }

    if (!['draft', 'in_progress'].includes(task.status)) {
      return res.status(400).json({
        success: false,
        message: '只能取消草稿或进行中的任务'
      });
    }

    const oldTask = { ...task.toJSON() };

    await task.update({
      status: 'cancelled',
      version: task.version + 1
    });

    await historyService.logAction('cancel', task, req.user, req, '取消盘点');

    res.json({
      success: true,
      data: task
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;