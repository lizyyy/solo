const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const ResponseHandler = require('../utils/responseHandler');
const ReservationService = require('../services/ReservationService');
const LoanService = require('../services/LoanService');
const { Reservation, Item, User, Loan } = require('../models');

router.get('/', async (req, res) => {
  try {
    const { user_id, item_id, status, page = 1, pageSize = 20 } = req.query;
    
    const where = {};
    
    if (user_id) {
      where.user_id = user_id;
    }
    
    if (item_id) {
      where.item_id = item_id;
    }
    
    if (status) {
      where.status = status;
    }
    
    const offset = (page - 1) * pageSize;
    const limit = parseInt(pageSize);
    
    const { count, rows } = await Reservation.findAndCountAll({
      where,
      include: [
        { model: User, as: 'user', attributes: ['id', 'name', 'phone'] },
        { model: Item, as: 'item' },
        { model: Loan, as: 'loan' },
      ],
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
    const reservation = await ReservationService.getReservationById(req.params.id);
    return ResponseHandler.success(res, reservation);
  } catch (error) {
    return ResponseHandler.error(res, error);
  }
});

router.post('/', async (req, res) => {
  try {
    const {
      user_id,
      item_id,
      start_time,
      end_time,
      quantity = 1,
      notes,
    } = req.body;
    
    if (!user_id || !item_id || !start_time || !end_time) {
      return ResponseHandler.validationError(
        res,
        {
          user_id: '用户ID不能为空',
          item_id: '物品ID不能为空',
          start_time: '开始时间不能为空',
          end_time: '结束时间不能为空',
        },
        '缺少必要参数'
      );
    }
    
    const reservation = await ReservationService.createReservation(
      user_id,
      item_id,
      start_time,
      end_time,
      quantity,
      notes
    );
    
    return ResponseHandler.created(res, reservation, '预约创建成功');
  } catch (error) {
    return ResponseHandler.error(res, error);
  }
});

router.post('/:id/cancel', async (req, res) => {
  try {
    const { reason } = req.body;
    
    const result = await ReservationService.cancelReservation(
      req.params.id,
      reason || '用户主动取消'
    );
    
    return ResponseHandler.success(res, result, '预约取消成功');
  } catch (error) {
    return ResponseHandler.error(res, error);
  }
});

router.post('/:id/checkout', async (req, res) => {
  try {
    const { admin_id, notes } = req.body;
    
    const loan = await LoanService.checkoutFromReservation(
      req.params.id,
      admin_id,
      notes
    );
    
    return ResponseHandler.success(res, loan, '取货确认成功');
  } catch (error) {
    return ResponseHandler.error(res, error);
  }
});

router.get('/overdue/check', async (req, res) => {
  try {
    const result = await ReservationService.processTimeoutReservations();
    return ResponseHandler.success(res, result, '超时预约检查完成');
  } catch (error) {
    return ResponseHandler.error(res, error);
  }
});

module.exports = router;
