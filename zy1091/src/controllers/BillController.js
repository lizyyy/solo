const { Bill, SplitRule, PaymentRecord, Flatmate } = require('../models');
const { BillService } = require('../services');
const { wrapAsync, AppError } = require('../middlewares');
const { ERROR_CODES, STATUS_MAP, SPLIT_TYPES } = require('../config/constants');

class BillController {
  static getAll = wrapAsync(async (req, res, next) => {
    const { status, category, start_date, end_date, created_by, limit = 20, offset = 0 } = req.query;
    
    const whereClause = {};
    
    if (status) {
      whereClause.status = status;
    }
    
    if (category) {
      whereClause.category = category;
    }
    
    if (created_by) {
      whereClause.creator_id = created_by;
    }
    
    if (start_date || end_date) {
      whereClause.created_at = {};
      if (start_date) {
        whereClause.created_at.$gte = new Date(start_date);
      }
      if (end_date) {
        whereClause.created_at.$lte = new Date(end_date);
      }
    }
    
    const bills = await Bill.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: Flatmate,
          as: 'creator',
          attributes: ['id', 'name'],
        },
      ],
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset),
    });
    
    // 计算统计数据
    const stats = {};
    if (Object.keys(whereClause).length === 0) {
      const allBills = await Bill.findAll();
      let totalAmount = 0;
      let totalPaid = 0;
      let pendingCount = 0;
      let overdueCount = 0;
      let settledCount = 0;
      
      for (const bill of allBills) {
        totalAmount += parseFloat(bill.total_amount);
        totalPaid += parseFloat(bill.total_paid_amount);
        
        switch (bill.status) {
          case STATUS_MAP.BILL.PENDING:
          case STATUS_MAP.BILL.PARTIAL:
            pendingCount++;
            break;
          case STATUS_MAP.BILL.OVERDUE:
            overdueCount++;
            break;
          case STATUS_MAP.BILL.SETTLED:
            settledCount++;
            break;
        }
      }
      
      stats.total_amount = totalAmount.toFixed(2);
      stats.total_paid = totalPaid.toFixed(2);
      stats.pending_count = pendingCount;
      stats.overdue_count = overdueCount;
      stats.settled_count = settledCount;
    }
    
    res.json({
      success: true,
      data: {
        bills: bills.rows,
        total: bills.count,
        limit: parseInt(limit),
        offset: parseInt(offset),
        ...(Object.keys(stats).length > 0 && { stats }),
      },
    });
  });

  static getById = wrapAsync(async (req, res, next) => {
    const { id } = req.params;
    
    try {
      const bill = await BillService.getBillWithDetails(id);
      
      res.json({
        success: true,
        data: {
          bill,
        },
      });
    } catch (error) {
      if (error.code === ERROR_CODES.BILL_NOT_FOUND) {
        return next(new AppError(error.message, 404, error.code));
      }
      next(error);
    }
  });

  static create = wrapAsync(async (req, res, next) => {
    // 简化的用户认证：假设从请求头获取当前用户ID
    // 实际生产环境应该使用JWT或Session
    const creatorId = req.headers['x-user-id'] || 1;
    
    try {
      const result = await BillService.createBill(req.body, parseInt(creatorId));
      
      res.status(201).json({
        success: true,
        data: {
          bill: result.bill,
          split_rules: result.splitRules,
        },
        message: '账单创建成功',
      });
    } catch (error) {
      if (error.code) {
        return next(new AppError(error.message, 400, error.code));
      }
      next(error);
    }
  });

  static update = wrapAsync(async (req, res, next) => {
    const { id } = req.params;
    const { title, description, category, due_date, notes } = req.body;
    
    const bill = await Bill.findOne({
      where: { id },
    });
    
    if (!bill) {
      return next(new AppError('账单不存在', 404, ERROR_CODES.BILL_NOT_FOUND));
    }
    
    // 已结清或有争议的账单不允许修改
    if (bill.status === STATUS_MAP.BILL.SETTLED) {
      return next(new AppError('账单已结清，无法修改', 400, ERROR_CODES.BILL_ALREADY_SETTLED));
    }
    
    if (bill.has_dispute) {
      return next(new AppError('账单存在争议，无法修改', 400, ERROR_CODES.BILL_HAS_DISPUTE));
    }
    
    await bill.update({
      title,
      description,
      category,
      due_date,
      notes,
    });
    
    res.json({
      success: true,
      data: {
        bill,
      },
      message: '账单更新成功',
    });
  });

  static delete = wrapAsync(async (req, res, next) => {
    const { id } = req.params;
    
    const bill = await Bill.findOne({
      where: { id },
      include: [
        { model: SplitRule, as: 'splitRules' },
        { model: PaymentRecord, as: 'paymentRecords' },
      ],
    });
    
    if (!bill) {
      return next(new AppError('账单不存在', 404, ERROR_CODES.BILL_NOT_FOUND));
    }
    
    // 有付款记录的账单不允许删除
    if (bill.paymentRecords && bill.paymentRecords.length > 0) {
      return next(
        new AppError(
          '账单已有付款记录，无法删除。您可以创建争议单来处理',
          400,
          ERROR_CODES.INVALID_INPUT
        )
      );
    }
    
    // 删除分摊规则
    if (bill.splitRules && bill.splitRules.length > 0) {
      await SplitRule.destroy({
        where: { bill_id: id },
      });
    }
    
    await bill.destroy();
    
    res.json({
      success: true,
      message: '账单已删除',
    });
  });

  static getSplitRules = wrapAsync(async (req, res, next) => {
    const { bill_id } = req.params;
    
    const bill = await Bill.findOne({
      where: { id: bill_id },
    });
    
    if (!bill) {
      return next(new AppError('账单不存在', 404, ERROR_CODES.BILL_NOT_FOUND));
    }
    
    const splitRules = await SplitRule.findAll({
      where: { bill_id },
      include: [
        {
          model: Flatmate,
          as: 'flatmate',
          attributes: ['id', 'name'],
        },
      ],
    });
    
    res.json({
      success: true,
      data: {
        split_rules: splitRules,
      },
    });
  });

  static getPayments = wrapAsync(async (req, res, next) => {
    const { bill_id } = req.params;
    const { status } = req.query;
    
    const bill = await Bill.findOne({
      where: { id: bill_id },
    });
    
    if (!bill) {
      return next(new AppError('账单不存在', 404, ERROR_CODES.BILL_NOT_FOUND));
    }
    
    const whereClause = { bill_id };
    if (status) {
      whereClause.status = status;
    }
    
    const payments = await PaymentRecord.findAll({
      where: whereClause,
      include: [
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
    });
    
    res.json({
      success: true,
      data: {
        payments,
      },
    });
  });

  static getBalanceSummary = wrapAsync(async (req, res, next) => {
    try {
      const summary = await BillService.getBalanceSummary();
      
      // 检查是否有逾期风险
      const hasOverdueRisk = parseFloat(summary.total_overdue) > 0;
      const hasPendingBills = parseFloat(summary.total_pending) > 0;
      
      res.json({
        success: true,
        data: {
          summary,
          alerts: {
            has_overdue_risk: hasOverdueRisk,
            has_pending_bills: hasPendingBills,
            overdue_amount: summary.total_overdue,
            pending_amount: summary.total_pending,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  });

  static getFlatmateStatement = wrapAsync(async (req, res, next) => {
    const { flatmate_id } = req.params;
    const { start_date, end_date, status } = req.query;
    
    try {
      const statement = await BillService.getFlatmateStatement(
        parseInt(flatmate_id),
        {
          startDate: start_date,
          endDate: end_date,
          status,
        }
      );
      
      // 检查风险
      const hasOverdue = parseFloat(statement.summary.overdue_amount) > 0;
      const hasPending = parseFloat(statement.summary.pending_amount) > 0;
      
      res.json({
        success: true,
        data: {
          statement,
          alerts: {
            has_overdue,
            has_pending: hasPending,
            overdue_amount: statement.summary.overdue_amount,
            pending_amount: statement.summary.pending_amount,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  });
}

module.exports = BillController;
