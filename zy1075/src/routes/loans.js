const express = require('express');
const router = express.Router();
const ResponseHandler = require('../utils/responseHandler');
const LoanService = require('../services/LoanService');
const ReturnService = require('../services/ReturnService');
const { Loan, Item, User, Reservation, ReturnRecord } = require('../models');

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
    
    const { count, rows } = await Loan.findAndCountAll({
      where,
      include: [
        { model: User, as: 'user', attributes: ['id', 'name', 'phone'] },
        { model: Item, as: 'item' },
        { model: Reservation, as: 'reservation' },
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

router.get('/active', async (req, res) => {
  try {
    const loans = await LoanService.getActiveLoans();
    return ResponseHandler.success(res, loans);
  } catch (error) {
    return ResponseHandler.error(res, error);
  }
});

router.get('/:id', async (req, res) => {
  try {
    const loan = await LoanService.getLoanById(req.params.id);
    return ResponseHandler.success(res, loan);
  } catch (error) {
    return ResponseHandler.error(res, error);
  }
});

router.post('/direct', async (req, res) => {
  try {
    const {
      user_id,
      item_id,
      start_time,
      end_time,
      quantity = 1,
      admin_id,
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
    
    const loan = await LoanService.directCheckout(
      user_id,
      item_id,
      start_time,
      end_time,
      quantity,
      admin_id,
      notes
    );
    
    return ResponseHandler.created(res, loan, '直接借出成功');
  } catch (error) {
    return ResponseHandler.error(res, error);
  }
});

router.post('/:id/return', async (req, res) => {
  try {
    const {
      condition = 'good',
      damage_description,
      damage_estimate = 0,
      admin_id,
      notes,
    } = req.body;
    
    const validConditions = ['excellent', 'good', 'fair', 'poor', 'damaged', 'lost'];
    if (!validConditions.includes(condition)) {
      return ResponseHandler.validationError(
        res,
        { condition: `状态必须是以下之一：${validConditions.join(', ')}` }
      );
    }
    
    const result = await ReturnService.processReturn(
      req.params.id,
      condition,
      damage_description,
      damage_estimate,
      admin_id,
      notes
    );
    
    return ResponseHandler.success(res, result, result.message);
  } catch (error) {
    return ResponseHandler.error(res, error);
  }
});

router.get('/overdue/check', async (req, res) => {
  try {
    const result = await LoanService.checkAndUpdateOverdueStatus();
    return ResponseHandler.success(res, result, '逾期状态检查完成');
  } catch (error) {
    return ResponseHandler.error(res, error);
  }
});

module.exports = router;
