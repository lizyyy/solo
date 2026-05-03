const express = require('express');
const router = express.Router();
const ResponseHandler = require('../utils/responseHandler');
const WaitlistService = require('../services/WaitlistService');
const { Waitlist, Item, User, Reservation } = require('../models');

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
    
    const { count, rows } = await Waitlist.findAndCountAll({
      where,
      include: [
        { model: User, as: 'user', attributes: ['id', 'name', 'phone'] },
        { model: Item, as: 'item' },
        { model: Reservation, as: 'originalReservation' },
        { model: Reservation, as: 'convertedReservation' },
      ],
      offset,
      limit,
      order: [['position', 'ASC'], ['created_at', 'DESC']],
    });
    
    return ResponseHandler.pagination(res, rows, count, parseInt(page), limit);
  } catch (error) {
    return ResponseHandler.error(res, error);
  }
});

router.get('/item/:itemId', async (req, res) => {
  try {
    const { includeAll } = req.query;
    const waitlists = await WaitlistService.getItemWaitlist(
      req.params.itemId,
      includeAll === 'true'
    );
    return ResponseHandler.success(res, waitlists);
  } catch (error) {
    return ResponseHandler.error(res, error);
  }
});

router.get('/:id', async (req, res) => {
  try {
    const waitlist = await WaitlistService.getWaitlistById(req.params.id);
    return ResponseHandler.success(res, waitlist);
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
      original_reservation_id,
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
    
    const waitlist = await WaitlistService.addToWaitlist(
      user_id,
      item_id,
      start_time,
      end_time,
      quantity,
      original_reservation_id,
      notes
    );
    
    return ResponseHandler.created(res, waitlist, '成功加入候补队列');
  } catch (error) {
    return ResponseHandler.error(res, error);
  }
});

router.post('/:id/cancel', async (req, res) => {
  try {
    const { user_id } = req.body;
    
    if (!user_id) {
      return ResponseHandler.validationError(
        res,
        { user_id: '用户ID不能为空' }
      );
    }
    
    const result = await WaitlistService.removeFromWaitlist(
      req.params.id,
      user_id,
      '用户主动取消'
    );
    
    return ResponseHandler.success(res, result, '已成功从候补队列中移除');
  } catch (error) {
    return ResponseHandler.error(res, error);
  }
});

router.get('/expired/check', async (req, res) => {
  try {
    const result = await WaitlistService.checkWaitlistExpiration();
    return ResponseHandler.success(res, result, '过期候补检查完成');
  } catch (error) {
    return ResponseHandler.error(res, error);
  }
});

module.exports = router;
