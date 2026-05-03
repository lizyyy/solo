const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const { Item, User } = require('../models');
const ResponseHandler = require('../utils/responseHandler');
const { NotFoundError, ValidationError } = require('../utils/errors');
const TimelineService = require('../services/TimelineService');

router.get('/', async (req, res) => {
  try {
    const { category, status, search, page = 1, pageSize = 20 } = req.query;
    
    const where = {};
    
    if (category) {
      where.category = category;
    }
    
    if (status) {
      where.status = status;
    }
    
    if (search) {
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { description: { [Op.like]: `%${search}%` } },
      ];
    }
    
    const offset = (page - 1) * pageSize;
    const limit = parseInt(pageSize);
    
    const { count, rows } = await Item.findAndCountAll({
      where,
      offset,
      limit,
      order: [['created_at', 'DESC']],
    });
    
    return ResponseHandler.pagination(res, rows, count, parseInt(page), limit);
  } catch (error) {
    return ResponseHandler.error(res, error);
  }
});

router.get('/:id', async (req, res) => {
  try {
    const item = await Item.findByPk(req.params.id);
    
    if (!item) {
      return ResponseHandler.notFound(res, '物品不存在');
    }
    
    return ResponseHandler.success(res, item);
  } catch (error) {
    return ResponseHandler.error(res, error);
  }
});

router.post('/', async (req, res) => {
  try {
    const {
      name,
      description,
      category,
      total_quantity,
      available_quantity,
      status,
      deposit_amount,
      overdue_rate,
      max_loan_hours,
      notes,
    } = req.body;
    
    if (!name) {
      return ResponseHandler.validationError(res, { name: '物品名称不能为空' });
    }
    
    const item = await Item.create({
      name,
      description,
      category: category || '未分类',
      total_quantity: total_quantity || 1,
      available_quantity: available_quantity || total_quantity || 1,
      status: status || 'available',
      deposit_amount: deposit_amount || 0,
      overdue_rate: overdue_rate || parseFloat(process.env.OVERDUE_RATE_PER_HOUR) || 10,
      max_loan_hours,
      notes,
    });
    
    return ResponseHandler.created(res, item, '物品创建成功');
  } catch (error) {
    return ResponseHandler.error(res, error);
  }
});

router.put('/:id', async (req, res) => {
  try {
    const item = await Item.findByPk(req.params.id);
    
    if (!item) {
      return ResponseHandler.notFound(res, '物品不存在');
    }
    
    const {
      name,
      description,
      category,
      total_quantity,
      available_quantity,
      status,
      deposit_amount,
      overdue_rate,
      max_loan_hours,
      notes,
    } = req.body;
    
    await item.update({
      name: name !== undefined ? name : item.name,
      description: description !== undefined ? description : item.description,
      category: category !== undefined ? category : item.category,
      total_quantity: total_quantity !== undefined ? total_quantity : item.total_quantity,
      available_quantity: available_quantity !== undefined ? available_quantity : item.available_quantity,
      status: status !== undefined ? status : item.status,
      deposit_amount: deposit_amount !== undefined ? deposit_amount : item.deposit_amount,
      overdue_rate: overdue_rate !== undefined ? overdue_rate : item.overdue_rate,
      max_loan_hours: max_loan_hours !== undefined ? max_loan_hours : item.max_loan_hours,
      notes: notes !== undefined ? notes : item.notes,
    });
    
    return ResponseHandler.success(res, item, '物品更新成功');
  } catch (error) {
    return ResponseHandler.error(res, error);
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const item = await Item.findByPk(req.params.id);
    
    if (!item) {
      return ResponseHandler.notFound(res, '物品不存在');
    }
    
    await item.destroy();
    
    return ResponseHandler.success(res, null, '物品删除成功');
  } catch (error) {
    return ResponseHandler.error(res, error);
  }
});

router.get('/:id/timeline', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const timeline = await TimelineService.getItemTimeline(
      req.params.id,
      startDate,
      endDate
    );
    
    return ResponseHandler.success(res, timeline);
  } catch (error) {
    return ResponseHandler.error(res, error);
  }
});

router.post('/check-availability', async (req, res) => {
  try {
    const { item_id, start_time, end_time, quantity = 1 } = req.body;
    
    if (!item_id || !start_time || !end_time) {
      return ResponseHandler.validationError(
        res,
        { item_id: '物品ID不能为空', start_time: '开始时间不能为空', end_time: '结束时间不能为空' },
        '缺少必要参数'
      );
    }
    
    const item = await Item.findByPk(item_id);
    if (!item) {
      return ResponseHandler.notFound(res, '物品不存在');
    }
    
    if (item.status === 'maintenance') {
      return ResponseHandler.conflict(
        res,
        `${item.name}正在维护中，暂时无法预约`,
        '建议选择其他时间段或其他物品'
      );
    }
    
    if (item.status === 'unavailable') {
      return ResponseHandler.conflict(
        res,
        `${item.name}当前不可用`,
        '建议选择其他物品'
      );
    }
    
    const moment = require('moment');
    const start = moment(start_time);
    const end = moment(end_time);
    
    if (!start.isValid() || !end.isValid()) {
      return ResponseHandler.validationError(res, null, '时间格式无效');
    }
    
    if (end.isBefore(start)) {
      return ResponseHandler.validationError(res, null, '结束时间不能早于开始时间');
    }
    
    const { Reservation } = require('../models');
    const overlappingReservations = await Reservation.findAll({
      where: {
        item_id,
        status: { [Op.in]: ['confirmed', 'checkout'] },
        start_time: { [Op.lt]: end_time },
        end_time: { [Op.gt]: start_time },
      },
      include: [
        { model: User, as: 'user', attributes: ['id', 'name'] },
      ],
    });
    
    const reservedQuantity = overlappingReservations.reduce(
      (sum, res) => sum + res.quantity,
      0
    );
    
    const availableQuantity = item.total_quantity - reservedQuantity;
    const isAvailable = quantity <= availableQuantity;
    
    return ResponseHandler.success(res, {
      item_id,
      item_name: item.name,
      is_available: isAvailable,
      total_quantity: item.total_quantity,
      available_quantity: availableQuantity,
      requested_quantity: quantity,
      overlapping_reservations: overlappingReservations.length > 0 
        ? overlappingReservations.map(r => ({
            id: r.id,
            user_name: r.user?.name,
            start_time: r.start_time,
            end_time: r.end_time,
            quantity: r.quantity,
          }))
        : [],
      suggestion: isAvailable 
        ? '该时间段可用，可以进行预约'
        : `该时间段库存不足，当前可借${availableQuantity}件，需要${quantity}件。建议减少数量或选择其他时间段`,
    });
  } catch (error) {
    return ResponseHandler.error(res, error);
  }
});

module.exports = router;
