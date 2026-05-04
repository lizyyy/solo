const express = require('express');
const router = express.Router();
const { sequelize } = require('../models');
const { InventoryBatch, Product, GroupBatch, Freezer, InventoryAllocation, OrderItem } = require('../models');
const { Op } = require('sequelize');
const dayjs = require('dayjs');
const inventoryService = require('../services/inventoryService');

router.get('/', async (req, res) => {
  try {
    const { product_id, group_batch_id, status, expiring, freezer_id } = req.query;
    const whereClause = {};

    if (product_id) whereClause.product_id = product_id;
    if (group_batch_id) whereClause.group_batch_id = group_batch_id;
    if (status) whereClause.status = status;
    if (freezer_id) whereClause.freezer_id = freezer_id;

    if (expiring === 'true') {
      const today = dayjs().format('YYYY-MM-DD');
      const weekLater = dayjs().add(7, 'day').format('YYYY-MM-DD');
      whereClause.expiry_date = {
        [Op.between]: [today, weekLater]
      };
    }

    const inventory = await InventoryBatch.findAll({
      where: whereClause,
      include: [Product, GroupBatch, Freezer],
      order: [['expiry_date', 'ASC']]
    });

    const inventoryWithDetails = inventory.map(item => ({
      ...item.toJSON(),
      available_quantity: item.quantity - item.allocated_quantity,
      days_until_expiry: item.expiry_date ? dayjs(item.expiry_date).diff(dayjs(), 'day') : null,
      is_expiring: item.expiry_date && dayjs(item.expiry_date).diff(dayjs(), 'day') <= 7,
      is_expired: item.expiry_date && dayjs(item.expiry_date).diff(dayjs(), 'day') <= 0
    }));

    res.json({
      success: true,
      data: inventoryWithDetails
    });
  } catch (error) {
    console.error('获取库存列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取库存列表失败',
      error: error.message
    });
  }
});

router.get('/expiring', async (req, res) => {
  try {
    const { days = 7 } = req.query;
    const expiringItems = await inventoryService.getExpiringInventory(parseInt(days));

    res.json({
      success: true,
      data: expiringItems,
      summary: {
        total: expiringItems.length,
        urgent: expiringItems.filter(i => i.isExpiring || i.isExpired).length
      }
    });
  } catch (error) {
    console.error('获取临期库存失败:', error);
    res.status(500).json({
      success: false,
      message: '获取临期库存失败',
      error: error.message
    });
  }
});

router.get('/summary', async (req, res) => {
  try {
    const { product_id } = req.query;
    const summary = await inventoryService.getInventorySummary(product_id);

    res.json({
      success: true,
      data: summary
    });
  } catch (error) {
    console.error('获取库存汇总失败:', error);
    res.status(500).json({
      success: false,
      message: '获取库存汇总失败',
      error: error.message
    });
  }
});

router.get('/stats', async (req, res) => {
  try {
    const totalInventory = await InventoryBatch.sum('quantity');
    const totalAllocated = await InventoryBatch.sum('allocated_quantity');

    const expiringItems = await inventoryService.getExpiringInventory(7);
    const expiryQuantity = expiringItems.reduce((sum, item) => sum + (item.available_quantity || item.quantity - item.allocated_quantity), 0);

    const stats = {
      total_quantity: totalInventory || 0,
      allocated_quantity: totalAllocated || 0,
      available_quantity: (totalInventory || 0) - (totalAllocated || 0),
      expiry_quantity: expiryQuantity
    };

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('获取库存统计失败:', error);
    res.status(500).json({
      success: false,
      message: '获取库存统计失败',
      error: error.message
    });
  }
});

router.post('/', async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const {
      product_id, group_batch_id, supplier_name, supplier_batch_no,
      production_date, expiry_date, quantity, freezer_id, note
    } = req.body;

    if (!product_id || !quantity) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: '商品ID和数量为必填项'
      });
    }

    const product = await Product.findByPk(product_id, { transaction });
    if (!product) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: '商品不存在'
      });
    }

    const capacityCheck = await inventoryService.checkFreezerCapacity(product_id, quantity, transaction);
    
    if (!capacityCheck.success) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: capacityCheck.message,
        details: capacityCheck
      });
    }

    const inventoryBatch = await InventoryBatch.create({
      batch_no: `INV${Date.now()}`,
      product_id,
      group_batch_id,
      supplier_name,
      supplier_batch_no,
      production_date,
      expiry_date,
      quantity,
      allocated_quantity: 0,
      picked_quantity: 0,
      freezer_id,
      freezer_unit: product.unit || '件',
      status: 'in_stock',
      note
    }, { transaction });

    if (freezer_id) {
      const freezer = await Freezer.findByPk(freezer_id, { transaction });
      if (freezer) {
        freezer.used_capacity += quantity;
        if (freezer.used_capacity >= freezer.capacity) {
          freezer.status = 'full';
        }
        await freezer.save({ transaction });
      }
    }

    await transaction.commit();

    res.status(201).json({
      success: true,
      message: '库存批次创建成功',
      data: inventoryBatch
    });
  } catch (error) {
    await transaction.rollback();
    console.error('创建库存批次失败:', error);
    res.status(500).json({
      success: false,
      message: '创建库存批次失败',
      error: error.message
    });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const inventory = await InventoryBatch.findByPk(req.params.id, {
      include: [Product, GroupBatch, Freezer, 
        {
          model: InventoryAllocation,
          include: [OrderItem]
        }
      ]
    });
    
    if (!inventory) {
      return res.status(404).json({
        success: false,
        message: '库存批次不存在'
      });
    }

    const inventoryWithDetails = {
      ...inventory.toJSON(),
      available_quantity: inventory.quantity - inventory.allocated_quantity,
      days_until_expiry: inventory.expiry_date ? dayjs(inventory.expiry_date).diff(dayjs(), 'day') : null,
      is_expiring: inventory.expiry_date && dayjs(inventory.expiry_date).diff(dayjs(), 'day') <= 7,
      is_expired: inventory.expiry_date && dayjs(inventory.expiry_date).diff(dayjs(), 'day') <= 0
    };

    res.json({
      success: true,
      data: inventoryWithDetails
    });
  } catch (error) {
    console.error('获取库存详情失败:', error);
    res.status(500).json({
      success: false,
      message: '获取库存详情失败',
      error: error.message
    });
  }
});

router.put('/:id/assign-freezer', async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    const { freezer_id, quantity } = req.body;
    
    if (!freezer_id) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: '冰柜ID为必填项'
      });
    }

    const result = await inventoryService.assignToFreezer(
      req.params.id, 
      freezer_id, 
      quantity || 1,
      transaction
    );

    if (!result.success) {
      await transaction.rollback();
      return res.status(400).json(result);
    }

    await transaction.commit();
    res.json(result);
  } catch (error) {
    await transaction.rollback();
    console.error('分配冰柜失败:', error);
    res.status(500).json({
      success: false,
      message: '分配冰柜失败',
      error: error.message
    });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const inventory = await InventoryBatch.findByPk(req.params.id);
    
    if (!inventory) {
      return res.status(404).json({
        success: false,
        message: '库存批次不存在'
      });
    }

    const { supplier_name, supplier_batch_no, production_date, expiry_date, note } = req.body;

    await inventory.update({
      supplier_name,
      supplier_batch_no,
      production_date,
      expiry_date,
      note
    });

    res.json({
      success: true,
      message: '库存批次更新成功',
      data: inventory
    });
  } catch (error) {
    console.error('更新库存批次失败:', error);
    res.status(500).json({
      success: false,
      message: '更新库存批次失败',
      error: error.message
    });
  }
});

module.exports = router;