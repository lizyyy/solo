const express = require('express');
const router = express.Router();
const { PickupSlot, Order, GroupBatch } = require('../models');
const { Op } = require('sequelize');
const dayjs = require('dayjs');
const pickupSlotService = require('../services/pickupSlotService');

router.get('/', async (req, res) => {
  try {
    const { date, group_batch_id, status } = req.query;
    const whereClause = {};

    if (date) whereClause.date = date;
    if (group_batch_id) whereClause.group_batch_id = group_batch_id;
    if (status) whereClause.status = status;

    const slots = await PickupSlot.findAll({
      where: whereClause,
      include: [
        GroupBatch,
        {
          model: Order,
          where: { status: { [Op.in]: ['paid', 'allocated'] } },
          required: false
        }
      ],
      order: [['date', 'ASC'], ['start_time', 'ASC']]
    });

    const slotsWithDetails = slots.map(slot => {
      const currentOrders = slot.Orders ? slot.Orders.length : slot.current_orders;
      return {
        ...slot.toJSON(),
        current_orders: currentOrders,
        available: currentOrders < slot.max_orders,
        remaining: slot.max_orders - currentOrders,
        load_ratio: ((currentOrders / slot.max_orders) * 100).toFixed(1),
        is_full: currentOrders >= slot.max_orders,
        is_overloaded: currentOrders >= slot.max_orders * 0.8
      };
    });

    res.json({
      success: true,
      data: slotsWithDetails
    });
  } catch (error) {
    console.error('获取自提时段列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取自提时段列表失败',
      error: error.message
    });
  }
});

router.get('/available', async (req, res) => {
  try {
    const { date } = req.query;
    const slots = await pickupSlotService.getAvailableSlots(date);

    res.json({
      success: true,
      data: slots
    });
  } catch (error) {
    console.error('获取可用时段失败:', error);
    res.status(500).json({
      success: false,
      message: '获取可用时段失败',
      error: error.message
    });
  }
});

router.get('/overloaded', async (req, res) => {
  try {
    const result = await pickupSlotService.getOverloadedSlots();

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('获取繁忙时段失败:', error);
    res.status(500).json({
      success: false,
      message: '获取繁忙时段失败',
      error: error.message
    });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const slot = await PickupSlot.findByPk(req.params.id, {
      include: [
        GroupBatch,
        {
          model: Order,
          where: { status: { [Op.in]: ['paid', 'allocated'] } },
          required: false,
          include: ['PickupSlot']
        }
      ]
    });
    
    if (!slot) {
      return res.status(404).json({
        success: false,
        message: '自提时段不存在'
      });
    }

    const currentOrders = slot.Orders ? slot.Orders.length : slot.current_orders;
    const slotWithDetails = {
      ...slot.toJSON(),
      current_orders: currentOrders,
      available: currentOrders < slot.max_orders,
      remaining: slot.max_orders - currentOrders,
      load_ratio: ((currentOrders / slot.max_orders) * 100).toFixed(1),
      is_full: currentOrders >= slot.max_orders,
      is_overloaded: currentOrders >= slot.max_orders * 0.8
    };

    res.json({
      success: true,
      data: slotWithDetails
    });
  } catch (error) {
    console.error('获取自提时段详情失败:', error);
    res.status(500).json({
      success: false,
      message: '获取自提时段详情失败',
      error: error.message
    });
  }
});

router.get('/:id/alternatives', async (req, res) => {
  try {
    const { count = 3 } = req.query;
    const result = await pickupSlotService.suggestAlternativeSlots(req.params.id, parseInt(count));

    if (!result.success) {
      return res.status(404).json(result);
    }

    res.json(result);
  } catch (error) {
    console.error('获取替代时段失败:', error);
    res.status(500).json({
      success: false,
      message: '获取替代时段失败',
      error: error.message
    });
  }
});

router.post('/', async (req, res) => {
  try {
    const { group_batch_id, date, start_time, end_time, max_orders, note } = req.body;

    if (!date || !start_time || !end_time) {
      return res.status(400).json({
        success: false,
        message: '日期、开始时间和结束时间为必填项'
      });
    }

    const conflictCheck = await pickupSlotService.checkTimeConflict(date, start_time, end_time);
    
    if (conflictCheck.hasConflict) {
      return res.status(400).json({
        success: false,
        message: '时间冲突',
        conflicts: conflictCheck.conflicts
      });
    }

    const slot = await PickupSlot.create({
      group_batch_id,
      date,
      start_time,
      end_time,
      max_orders: max_orders || 20,
      current_orders: 0,
      status: 'available'
    });

    res.status(201).json({
      success: true,
      message: '自提时段创建成功',
      data: slot
    });
  } catch (error) {
    console.error('创建自提时段失败:', error);
    res.status(500).json({
      success: false,
      message: '创建自提时段失败',
      error: error.message
    });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const slot = await PickupSlot.findByPk(req.params.id);
    
    if (!slot) {
      return res.status(404).json({
        success: false,
        message: '自提时段不存在'
      });
    }

    const { date, start_time, end_time, max_orders, status } = req.body;

    if (max_orders !== undefined && max_orders < slot.current_orders) {
      return res.status(400).json({
        success: false,
        message: `新容量不能小于当前订单数(${slot.current_orders})`
      });
    }

    if (date || start_time || end_time) {
      const conflictCheck = await pickupSlotService.checkTimeConflict(
        date || slot.date,
        start_time || slot.start_time,
        end_time || slot.end_time,
        slot.id
      );
      
      if (conflictCheck.hasConflict) {
        return res.status(400).json({
          success: false,
          message: '时间冲突',
          conflicts: conflictCheck.conflicts
        });
      }
    }

    await slot.update({
      date,
      start_time,
      end_time,
      max_orders,
      status
    });

    if (slot.current_orders >= slot.max_orders) {
      slot.status = 'full';
    } else if (slot.status === 'full' && slot.current_orders < slot.max_orders) {
      slot.status = 'available';
    }
    await slot.save();

    res.json({
      success: true,
      message: '自提时段更新成功',
      data: slot
    });
  } catch (error) {
    console.error('更新自提时段失败:', error);
    res.status(500).json({
      success: false,
      message: '更新自提时段失败',
      error: error.message
    });
  }
});

router.put('/:id/status', async (req, res) => {
  try {
    const slot = await PickupSlot.findByPk(req.params.id);
    
    if (!slot) {
      return res.status(404).json({
        success: false,
        message: '自提时段不存在'
      });
    }

    const { status } = req.body;
    const validStatuses = ['available', 'full', 'closed'];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: '无效的状态值'
      });
    }

    if (status === 'closed' && slot.current_orders > 0) {
      return res.status(400).json({
        success: false,
        message: `时段中有 ${slot.current_orders} 个订单，无法关闭`
      });
    }

    await slot.update({ status });

    res.json({
      success: true,
      message: `自提时段状态已更新为: ${status}`,
      data: slot
    });
  } catch (error) {
    console.error('更新自提时段状态失败:', error);
    res.status(500).json({
      success: false,
      message: '更新自提时段状态失败',
      error: error.message
    });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const slot = await PickupSlot.findByPk(req.params.id, {
      include: [{
        model: Order,
        where: { status: { [Op.in]: ['paid', 'allocated'] } },
        required: false
      }]
    });
    
    if (!slot) {
      return res.status(404).json({
        success: false,
        message: '自提时段不存在'
      });
    }

    if (slot.Orders && slot.Orders.length > 0) {
      return res.status(400).json({
        success: false,
        message: `时段中有 ${slot.Orders.length} 个订单，无法删除`
      });
    }

    await slot.destroy();

    res.json({
      success: true,
      message: '自提时段已删除'
    });
  } catch (error) {
    console.error('删除自提时段失败:', error);
    res.status(500).json({
      success: false,
      message: '删除自提时段失败',
      error: error.message
    });
  }
});

module.exports = router;
