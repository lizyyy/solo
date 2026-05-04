const express = require('express');
const router = express.Router();
const { GroupBatch, Order, InventoryBatch } = require('../models');
const { Op } = require('sequelize');

router.get('/', async (req, res) => {
  try {
    const { status, date_from, date_to } = req.query;
    const whereClause = {};

    if (status) whereClause.status = status;
    if (date_from) whereClause.start_time = { [Op.gte]: date_from };
    if (date_to) whereClause.end_time = { [Op.lte]: date_to };

    const batches = await GroupBatch.findAll({
      where: whereClause,
      include: [
        {
          model: Order,
          attributes: ['id', 'status']
        },
        {
          model: InventoryBatch,
          attributes: ['id', 'status']
        }
      ],
      order: [['created_at', 'DESC']]
    });

    const batchesWithStats = batches.map(batch => ({
      ...batch.toJSON(),
      orderCount: batch.Orders?.length || 0,
      inventoryCount: batch.InventoryBatches?.length || 0,
      paidOrders: batch.Orders?.filter(o => o.status === 'paid').length || 0,
      pickedOrders: batch.Orders?.filter(o => o.status === 'picked').length || 0
    }));

    res.json({
      success: true,
      data: batchesWithStats
    });
  } catch (error) {
    console.error('获取团购批次列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取团购批次列表失败',
      error: error.message
    });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const batch = await GroupBatch.findByPk(req.params.id, {
      include: [
        {
          model: Order,
          include: ['PickupSlot']
        },
        {
          model: InventoryBatch,
          include: ['Product', 'Freezer']
        }
      ]
    });
    
    if (!batch) {
      return res.status(404).json({
        success: false,
        message: '团购批次不存在'
      });
    }

    const batchData = batch.toJSON();
    batchData.orderStats = {
      total: batch.Orders?.length || 0,
      paid: batch.Orders?.filter(o => o.status === 'paid').length || 0,
      allocated: batch.Orders?.filter(o => o.status === 'allocated').length || 0,
      picked: batch.Orders?.filter(o => o.status === 'picked').length || 0
    };

    batchData.inventoryStats = {
      total: batch.InventoryBatches?.length || 0,
      inStock: batch.InventoryBatches?.filter(i => i.status === 'in_stock').length || 0,
      allocated: batch.InventoryBatches?.filter(i => i.status === 'allocated').length || 0
    };

    res.json({
      success: true,
      data: batchData
    });
  } catch (error) {
    console.error('获取团购批次详情失败:', error);
    res.status(500).json({
      success: false,
      message: '获取团购批次详情失败',
      error: error.message
    });
  }
});

router.post('/', async (req, res) => {
  try {
    const { batch_no, name, start_time, end_time, delivery_date, description } = req.body;

    if (!name || !start_time || !end_time) {
      return res.status(400).json({
        success: false,
        message: '团购名称、开始时间和结束时间为必填项'
      });
    }

    const batch = await GroupBatch.create({
      batch_no: batch_no || `BATCH${Date.now()}`,
      name,
      start_time,
      end_time,
      delivery_date,
      status: 'draft',
      description
    });

    res.status(201).json({
      success: true,
      message: '团购批次创建成功',
      data: batch
    });
  } catch (error) {
    console.error('创建团购批次失败:', error);
    res.status(500).json({
      success: false,
      message: '创建团购批次失败',
      error: error.message
    });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const batch = await GroupBatch.findByPk(req.params.id);
    
    if (!batch) {
      return res.status(404).json({
        success: false,
        message: '团购批次不存在'
      });
    }

    const { batch_no, name, start_time, end_time, delivery_date, status, description } = req.body;

    await batch.update({
      batch_no,
      name,
      start_time,
      end_time,
      delivery_date,
      status,
      description
    });

    res.json({
      success: true,
      message: '团购批次更新成功',
      data: batch
    });
  } catch (error) {
    console.error('更新团购批次失败:', error);
    res.status(500).json({
      success: false,
      message: '更新团购批次失败',
      error: error.message
    });
  }
});

router.put('/:id/status', async (req, res) => {
  try {
    const batch = await GroupBatch.findByPk(req.params.id);
    
    if (!batch) {
      return res.status(404).json({
        success: false,
        message: '团购批次不存在'
      });
    }

    const { status } = req.body;
    const validStatuses = ['draft', 'active', 'closed', 'delivered', 'completed'];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: '无效的状态值'
      });
    }

    await batch.update({ status });

    res.json({
      success: true,
      message: `团购批次状态已更新为: ${status}`,
      data: batch
    });
  } catch (error) {
    console.error('更新团购批次状态失败:', error);
    res.status(500).json({
      success: false,
      message: '更新团购批次状态失败',
      error: error.message
    });
  }
});

module.exports = router;
