const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const ResponseHandler = require('../utils/responseHandler');
const { User, Reservation, Loan, Waitlist, Deposit, Dispute } = require('../models');
const ReservationService = require('../services/ReservationService');
const LoanService = require('../services/LoanService');
const WaitlistService = require('../services/WaitlistService');
const ReturnService = require('../services/ReturnService');

router.get('/', async (req, res) => {
  try {
    const { role, status, search, page = 1, pageSize = 20 } = req.query;
    
    const where = {};
    
    if (role) {
      where.role = role;
    }
    
    if (status) {
      where.status = status;
    }
    
    if (search) {
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { phone: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } },
      ];
    }
    
    const offset = (page - 1) * pageSize;
    const limit = parseInt(pageSize);
    
    const { count, rows } = await User.findAndCountAll({
      where,
      offset,
      limit,
      attributes: { exclude: ['password'] },
      order: [['created_at', 'DESC']],
    });
    
    return ResponseHandler.pagination(res, rows, count, parseInt(page), limit);
  } catch (error) {
    return ResponseHandler.error(res, error);
  }
});

router.get('/:id', async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id, {
      attributes: { exclude: ['password'] },
    });
    
    if (!user) {
      return ResponseHandler.notFound(res, '用户不存在');
    }
    
    return ResponseHandler.success(res, user);
  } catch (error) {
    return ResponseHandler.error(res, error);
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, phone, email, role, balance } = req.body;
    
    if (!name) {
      return ResponseHandler.validationError(res, { name: '用户姓名不能为空' });
    }
    
    const existingUser = await User.findOne({
      where: {
        [Op.or]: [
          phone ? { phone } : null,
          email ? { email } : null,
        ].filter(Boolean),
      },
    });
    
    if (existingUser) {
      return ResponseHandler.conflict(
        res,
        '用户已存在',
        '手机号或邮箱已被注册，请使用其他信息'
      );
    }
    
    const user = await User.create({
      name,
      phone,
      email,
      role: role || 'user',
      balance: balance || 0,
      status: 'active',
    });
    
    return ResponseHandler.created(res, user, '用户创建成功');
  } catch (error) {
    return ResponseHandler.error(res, error);
  }
});

router.put('/:id', async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    
    if (!user) {
      return ResponseHandler.notFound(res, '用户不存在');
    }
    
    const { name, phone, email, role, balance, status } = req.body;
    
    await user.update({
      name: name !== undefined ? name : user.name,
      phone: phone !== undefined ? phone : user.phone,
      email: email !== undefined ? email : user.email,
      role: role !== undefined ? role : user.role,
      balance: balance !== undefined ? balance : user.balance,
      status: status !== undefined ? status : user.status,
    });
    
    return ResponseHandler.success(res, user, '用户更新成功');
  } catch (error) {
    return ResponseHandler.error(res, error);
  }
});

router.get('/:id/reservations', async (req, res) => {
  try {
    const { status } = req.query;
    const reservations = await ReservationService.getUserReservations(
      req.params.id,
      status
    );
    return ResponseHandler.success(res, reservations);
  } catch (error) {
    return ResponseHandler.error(res, error);
  }
});

router.get('/:id/loans', async (req, res) => {
  try {
    const { status } = req.query;
    const loans = await LoanService.getUserLoans(req.params.id, status);
    return ResponseHandler.success(res, loans);
  } catch (error) {
    return ResponseHandler.error(res, error);
  }
});

router.get('/:id/waitlists', async (req, res) => {
  try {
    const { status } = req.query;
    const waitlists = await WaitlistService.getUserWaitlists(req.params.id, status);
    return ResponseHandler.success(res, waitlists);
  } catch (error) {
    return ResponseHandler.error(res, error);
  }
});

router.get('/:id/disputes', async (req, res) => {
  try {
    const { status } = req.query;
    const disputes = await ReturnService.getUserDisputes(req.params.id, status);
    return ResponseHandler.success(res, disputes);
  } catch (error) {
    return ResponseHandler.error(res, error);
  }
});

router.get('/:id/deposits', async (req, res) => {
  try {
    const { status } = req.query;
    
    const where = { user_id: req.params.id };
    if (status) {
      where.status = status;
    }
    
    const deposits = await Deposit.findAll({
      where,
      include: [
        { model: Loan, as: 'loan', include: [{ model: Item, as: 'item' }] },
      ],
      order: [['created_at', 'DESC']],
    });
    
    return ResponseHandler.success(res, deposits);
  } catch (error) {
    return ResponseHandler.error(res, error);
  }
});

router.post('/:id/recharge', async (req, res) => {
  try {
    const { amount } = req.body;
    
    if (!amount || amount <= 0) {
      return ResponseHandler.validationError(
        res,
        { amount: '充值金额必须大于0' }
      );
    }
    
    const user = await User.findByPk(req.params.id);
    
    if (!user) {
      return ResponseHandler.notFound(res, '用户不存在');
    }
    
    await user.increment('balance', { by: amount });
    await user.reload();
    
    return ResponseHandler.success(
      res,
      { user, rechargeAmount: amount },
      `充值成功，当前余额：${user.balance}元`
    );
  } catch (error) {
    return ResponseHandler.error(res, error);
  }
});

module.exports = router;
