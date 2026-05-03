const { PaymentRecord, Bill, SplitRule, Flatmate } = require('../models');
const { BillService } = require('../services');
const { wrapAsync, AppError } = require('../middlewares');
const { ERROR_CODES, STATUS_MAP } = require('../config/constants');

class PaymentController {
  static getAll = wrapAsync(async (req, res, next) => {
    const { status, payer_id, receiver_id, bill_id, limit = 20, offset = 0 } = req.query;
    
    const whereClause = {};
    
    if (status) {
      whereClause.status = status;
    }
    
    if (payer_id) {
      whereClause.payer_id = payer_id;
    }
    
    if (receiver_id) {
      whereClause.receiver_id = receiver_id;
    }
    
    if (bill_id) {
      whereClause.bill_id = bill_id;
    }
    
    const payments = await PaymentRecord.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: Bill,
          as: 'bill',
          attributes: ['id', 'title', 'category'],
        },
        {
          model: Flatmate,
          as: 'payer',
          attributes: ['id', 'name'],
        },
        {
          model: Flatmate,
          as: 'receiver',
          attributes: ['id', 'name'],
        },
      ],
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset),
    });
    
    res.json({
      success: true,
      data: {
        payments: payments.rows,
        total: payments.count,
        limit: parseInt(limit),
        offset: parseInt(offset),
      },
    });
  });

  static getById = wrapAsync(async (req, res, next) => {
    const { id } = req.params;
    
    const payment = await PaymentRecord.findOne({
      where: { id },
      include: [
        {
          model: Bill,
          as: 'bill',
          include: [
            { model: SplitRule, as: 'splitRules' },
          ],
        },
        {
          model: SplitRule,
          as: 'splitRule',
          include: [
            { model: Flatmate, as: 'flatmate', attributes: ['id', 'name'] },
          ],
        },
        {
          model: Flatmate,
          as: 'payer',
          attributes: ['id', 'name'],
        },
        {
          model: Flatmate,
          as: 'receiver',
          attributes: ['id', 'name'],
        },
        {
          model: Flatmate,
          as: 'confirmer',
          attributes: ['id', 'name'],
        },
      ],
    });
    
    if (!payment) {
      return next(new AppError('付款记录不存在', 404, ERROR_CODES.PAYMENT_NOT_FOUND));
    }
    
    res.json({
      success: true,
      data: {
        payment,
      },
    });
  });

  static create = wrapAsync(async (req, res, next) => {
    // 从请求头获取付款人ID
    const payerId = req.headers['x-user-id'] || req.body.payer_id || 1;
    
    try {
      const result = await BillService.recordPayment(req.body, parseInt(payerId));
      
      res.status(201).json({
        success: true,
        data: {
          payment: result.paymentRecord,
          split_rule: result.updatedSplitRule,
          points_used: result.pointsUsed,
          monetary_value_used: result.monetaryValueUsed,
        },
        message: '付款记录创建成功',
      });
    } catch (error) {
      if (error.code) {
        const statusCode = error.code === ERROR_CODES.NOT_FOUND || error.code === ERROR_CODES.BILL_NOT_FOUND ? 404 : 400;
        return next(new AppError(error.message, statusCode, error.code));
      }
      next(error);
    }
  });

  static confirm = wrapAsync(async (req, res, next) => {
    const { payment_id } = req.body;
    const confirmerId = req.headers['x-user-id'] || 1;
    
    try {
      const payment = await BillService.confirmPayment(
        payment_id,
        parseInt(confirmerId)
      );
      
      res.json({
        success: true,
        data: {
          payment,
        },
        message: '付款已确认',
      });
    } catch (error) {
      if (error.code) {
        const statusCode = error.code === ERROR_CODES.PAYMENT_NOT_FOUND ? 404 : 400;
        return next(new AppError(error.message, statusCode, error.code));
      }
      next(error);
    }
  });

  static reject = wrapAsync(async (req, res, next) => {
    const { id } = req.params;
    const { rejection_reason } = req.body;
    const rejecterId = req.headers['x-user-id'] || 1;
    
    const payment = await PaymentRecord.findOne({
      where: { id },
      include: [
        { model: SplitRule, as: 'splitRule' },
        { model: Bill, as: 'bill' },
      ],
    });
    
    if (!payment) {
      return next(new AppError('付款记录不存在', 404, ERROR_CODES.PAYMENT_NOT_FOUND));
    }
    
    if (payment.status === STATUS_MAP.PAYMENT.CONFIRMED) {
      return next(new AppError('付款已确认，无法拒绝', 400, ERROR_CODES.PAYMENT_ALREADY_CONFIRMED));
    }
    
    if (payment.status === STATUS_MAP.PAYMENT.REJECTED) {
      return next(new AppError('付款已被拒绝', 400, ERROR_CODES.INVALID_INPUT));
    }
    
    // 更新付款记录
    await payment.update({
      status: STATUS_MAP.PAYMENT.REJECTED,
      rejected_at: new Date(),
      rejection_reason: rejection_reason || '付款被拒绝',
      confirmed_by_id: parseInt(rejecterId),
    });
    
    // 如果有对应的分摊规则，回滚已支付金额
    if (payment.splitRule) {
      const newPaidAmount = Math.max(
        0,
        parseFloat(payment.splitRule.paid_amount) - parseFloat(payment.amount)
      ).toFixed(2);
      
      await payment.splitRule.update({
        paid_amount: newPaidAmount,
        status: newPaidAmount >= parseFloat(payment.splitRule.amount) 
          ? STATUS_MAP.SPLIT_RULE.PAID 
          : (newPaidAmount > 0 ? STATUS_MAP.SPLIT_RULE.PARTIAL : STATUS_MAP.SPLIT_RULE.PENDING),
      });
    }
    
    // 更新账单状态
    if (payment.bill) {
      await BillService.updateBillStatus(payment.bill.id);
    }
    
    res.json({
      success: true,
      data: {
        payment,
      },
      message: '付款已拒绝',
    });
  });

  static getMyPayments = wrapAsync(async (req, res, next) => {
    const userId = req.headers['x-user-id'] || 1;
    const { status, limit = 20, offset = 0 } = req.query;
    
    const whereClause = {
      payer_id: parseInt(userId),
    };
    
    if (status) {
      whereClause.status = status;
    }
    
    const payments = await PaymentRecord.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: Bill,
          as: 'bill',
          attributes: ['id', 'title', 'category'],
        },
        {
          model: Flatmate,
          as: 'receiver',
          attributes: ['id', 'name'],
        },
      ],
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset),
    });
    
    // 计算统计
    const pendingCount = await PaymentRecord.count({
      where: {
        payer_id: parseInt(userId),
        status: STATUS_MAP.PAYMENT.PENDING,
      },
    });
    
    const confirmedCount = await PaymentRecord.count({
      where: {
        payer_id: parseInt(userId),
        status: STATUS_MAP.PAYMENT.CONFIRMED,
      },
    });
    
    res.json({
      success: true,
      data: {
        payments: payments.rows,
        total: payments.count,
        stats: {
          pending_count: pendingCount,
          confirmed_count: confirmedCount,
        },
        limit: parseInt(limit),
        offset: parseInt(offset),
      },
    });
  });

  static getPaymentsToConfirm = wrapAsync(async (req, res, next) => {
    const userId = req.headers['x-user-id'] || 1;
    const { limit = 20, offset = 0 } = req.query;
    
    // 查找付款人是当前用户，或者收款人是当前用户的待确认付款
    const payments = await PaymentRecord.findAndCountAll({
      where: {
        status: STATUS_MAP.PAYMENT.PENDING,
        receiver_id: parseInt(userId),
      },
      include: [
        {
          model: Bill,
          as: 'bill',
          attributes: ['id', 'title', 'category'],
        },
        {
          model: Flatmate,
          as: 'payer',
          attributes: ['id', 'name'],
        },
      ],
      order: [['created_at', 'ASC']],
      limit: parseInt(limit),
      offset: parseInt(offset),
    });
    
    res.json({
      success: true,
      data: {
        payments_to_confirm: payments.rows,
        total: payments.count,
        limit: parseInt(limit),
        offset: parseInt(offset),
      },
    });
  });
}

module.exports = PaymentController;
