const express = require('express');
const router = express.Router();
const { Freezer, InventoryBatch, Product } = require('../models');
const { Op } = require('sequelize');
const inventoryService = require('../services/inventoryService');

router.get('/', async (req, res) => {
  try {
    const { type, status } = req.query;
    const whereClause = {};

    if (type) whereClause.type = type;
    if (status) whereClause.status = status;

    const freezers = await Freezer.findAll({
      where: whereClause,
      include: [{
        model: InventoryBatch,
        include: [Product]
      }],
      order: [['created_at', 'DESC']]
    });

    const freezersWithDetails = freezers.map(freezer => ({
      ...freezer.toJSON(),
      available_capacity: freezer.capacity - freezer.used_capacity,
      usage_ratio: ((freezer.used_capacity / freezer.capacity) * 100).toFixed(1),
      is_full: freezer.used_capacity >= freezer.capacity,
      is_overloaded: freezer.used_capacity >= freezer.capacity * 0.9
    }));

    res.json({
      success: true,
      data: freezersWithDetails
    });
  } catch (error) {
    console.error('获取冰柜列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取冰柜列表失败',
      error: error.message
    });
  }
});

router.get('/summary', async (req, res) => {
  try {
    const freezers = await Freezer.findAll({
      include: [{
        model: InventoryBatch,
        where: { status: { [Op.ne]: 'depleted' } },
        required: false
      }]
    });

    const totalCapacity = freezers.reduce((sum, f) => sum + f.capacity, 0);
    const totalUsed = freezers.reduce((sum, f) => sum + f.used_capacity, 0);
    const fullFreezers = freezers.filter(f => f.used_capacity >= f.capacity).length;
    const overloadedFreezers = freezers.filter(f => f.used_capacity >= f.capacity * 0.9 && f.used_capacity < f.capacity).length;

    res.json({
      success: true,
      data: {
        total: freezers.length,
        totalCapacity,
        totalUsed,
        availableCapacity: totalCapacity - totalUsed,
        usageRatio: ((totalUsed / totalCapacity) * 100).toFixed(1),
        full: fullFreezers,
        overloaded: overloadedFreezers,
        normal: freezers.length - fullFreezers - overloadedFreezers
      }
    });
  } catch (error) {
    console.error('获取冰柜汇总失败:', error);
    res.status(500).json({
      success: false,
      message: '获取冰柜汇总失败',
      error: error.message
    });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const freezer = await Freezer.findByPk(req.params.id, {
      include: [{
        model: InventoryBatch,
        include: [Product],
        where: { status: { [Op.ne]: 'depleted' } },
        required: false
      }]
    });
    
    if (!freezer) {
      return res.status(404).json({
        success: false,
        message: '冰柜不存在'
      });
    }

    const freezerWithDetails = {
      ...freezer.toJSON(),
      available_capacity: freezer.capacity - freezer.used_capacity,
      usage_ratio: ((freezer.used_capacity / freezer.capacity) * 100).toFixed(1),
      is_full: freezer.used_capacity >= freezer.capacity,
      is_overloaded: freezer.used_capacity >= freezer.capacity * 0.9
    };

    res.json({
      success: true,
      data: freezerWithDetails
    });
  } catch (error) {
    console.error('获取冰柜详情失败:', error);
    res.status(500).json({
      success: false,
      message: '获取冰柜详情失败',
      error: error.message
    });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, code, type, capacity, location, note } = req.body;

    if (!name || !capacity) {
      return res.status(400).json({
        success: false,
        message: '冰柜名称和容量为必填项'
      });
    }

    const freezer = await Freezer.create({
      name,
      code,
      type: type || 'refrigerated',
      capacity,
      used_capacity: 0,
      location,
      status: 'active',
      note
    });

    res.status(201).json({
      success: true,
      message: '冰柜创建成功',
      data: freezer
    });
  } catch (error) {
    console.error('创建冰柜失败:', error);
    res.status(500).json({
      success: false,
      message: '创建冰柜失败',
      error: error.message
    });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const freezer = await Freezer.findByPk(req.params.id);
    
    if (!freezer) {
      return res.status(404).json({
        success: false,
        message: '冰柜不存在'
      });
    }

    const { name, code, type, capacity, location, status, note } = req.body;

    if (capacity !== undefined && capacity < freezer.used_capacity) {
      return res.status(400).json({
        success: false,
        message: `新容量不能小于已使用容量(${freezer.used_capacity})`
      });
    }

    await freezer.update({
      name,
      code,
      type,
      capacity,
      location,
      status,
      note
    });

    if (freezer.used_capacity >= freezer.capacity) {
      freezer.status = 'full';
    } else if (freezer.status === 'full' && freezer.used_capacity < freezer.capacity) {
      freezer.status = 'active';
    }
    await freezer.save();

    res.json({
      success: true,
      message: '冰柜更新成功',
      data: freezer
    });
  } catch (error) {
    console.error('更新冰柜失败:', error);
    res.status(500).json({
      success: false,
      message: '更新冰柜失败',
      error: error.message
    });
  }
});

router.put('/:id/status', async (req, res) => {
  try {
    const freezer = await Freezer.findByPk(req.params.id);
    
    if (!freezer) {
      return res.status(404).json({
        success: false,
        message: '冰柜不存在'
      });
    }

    const { status } = req.body;
    const validStatuses = ['active', 'maintenance', 'full'];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: '无效的状态值'
      });
    }

    if (status === 'maintenance' && freezer.used_capacity > 0) {
      return res.status(400).json({
        success: false,
        message: '冰柜中有商品，无法设置为维护状态'
      });
    }

    await freezer.update({ status });

    res.json({
      success: true,
      message: `冰柜状态已更新为: ${status}`,
      data: freezer
    });
  } catch (error) {
    console.error('更新冰柜状态失败:', error);
    res.status(500).json({
      success: false,
      message: '更新冰柜状态失败',
      error: error.message
    });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const freezer = await Freezer.findByPk(req.params.id, {
      include: [{
        model: InventoryBatch,
        where: { status: { [Op.ne]: 'depleted' } },
        required: false
      }]
    });
    
    if (!freezer) {
      return res.status(404).json({
        success: false,
        message: '冰柜不存在'
      });
    }

    if (freezer.InventoryBatches && freezer.InventoryBatches.length > 0) {
      return res.status(400).json({
        success: false,
        message: `冰柜中有 ${freezer.InventoryBatches.length} 个库存批次，无法删除`
      });
    }

    await freezer.destroy();

    res.json({
      success: true,
      message: '冰柜已删除'
    });
  } catch (error) {
    console.error('删除冰柜失败:', error);
    res.status(500).json({
      success: false,
      message: '删除冰柜失败',
      error: error.message
    });
  }
});

module.exports = router;
