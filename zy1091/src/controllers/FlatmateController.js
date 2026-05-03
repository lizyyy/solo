const { Flatmate, SplitRule, Bill } = require('../models');
const { wrapAsync, AppError } = require('../middlewares');
const { ERROR_CODES } = require('../config/constants');

class FlatmateController {
  static getAll = wrapAsync(async (req, res, next) => {
    const { status, include_inactive = false } = req.query;
    
    const whereClause = {};
    if (status) {
      whereClause.status = status;
    } else if (!include_inactive) {
      whereClause.status = 'active';
    }
    
    const flatmates = await Flatmate.findAll({
      where: whereClause,
      order: [['created_at', 'ASC']],
    });
    
    res.json({
      success: true,
      data: {
        flatmates,
      },
    });
  });

  static getById = wrapAsync(async (req, res, next) => {
    const { id } = req.params;
    
    const flatmate = await Flatmate.findOne({
      where: { id },
      include: [
        {
          model: SplitRule,
          as: 'splitRules',
          include: [
            {
              model: Bill,
              as: 'bill',
              attributes: ['id', 'title', 'category', 'status', 'created_at'],
            },
          ],
          limit: 10,
          order: [['created_at', 'DESC']],
        },
      ],
    });
    
    if (!flatmate) {
      return next(new AppError('室友不存在', 404, ERROR_CODES.FLATMATE_NOT_FOUND));
    }
    
    res.json({
      success: true,
      data: {
        flatmate,
      },
    });
  });

  static create = wrapAsync(async (req, res, next) => {
    const { name, email, phone, is_admin } = req.body;
    
    // 检查是否已存在同名的活跃室友
    const existingFlatmate = await Flatmate.findOne({
      where: {
        name,
        status: 'active',
      },
    });
    
    if (existingFlatmate) {
      return next(new AppError('已存在同名的活跃室友', 409, ERROR_CODES.CONFLICT));
    }
    
    const flatmate = await Flatmate.create({
      name,
      email,
      phone,
      is_admin,
      points: 0,
      status: 'active',
    });
    
    res.status(201).json({
      success: true,
      data: {
        flatmate,
      },
    });
  });

  static update = wrapAsync(async (req, res, next) => {
    const { id } = req.params;
    const updateData = req.body;
    
    const flatmate = await Flatmate.findOne({
      where: { id },
    });
    
    if (!flatmate) {
      return next(new AppError('室友不存在', 404, ERROR_CODES.FLATMATE_NOT_FOUND));
    }
    
    // 如果要修改为非活跃状态，检查是否有待支付的账单
    if (updateData.status && updateData.status !== 'active') {
      const pendingSplitRules = await SplitRule.findAll({
        where: {
          flatmate_id: id,
          status: ['pending', 'partial', 'disputed'],
        },
      });
      
      if (pendingSplitRules.length > 0) {
        return next(
          new AppError(
            `该室友有待处理的账单 (${pendingSplitRules.length} 条)，请先结清`,
            400,
            ERROR_CODES.INVALID_INPUT
          )
        );
      }
      
      updateData.leave_date = new Date();
    }
    
    await flatmate.update(updateData);
    
    res.json({
      success: true,
      data: {
        flatmate,
      },
    });
  });

  static delete = wrapAsync(async (req, res, next) => {
    const { id } = req.params;
    
    const flatmate = await Flatmate.findOne({
      where: { id },
    });
    
    if (!flatmate) {
      return next(new AppError('室友不存在', 404, ERROR_CODES.FLATMATE_NOT_FOUND));
    }
    
    // 检查是否有相关记录
    const splitRules = await SplitRule.findOne({
      where: { flatmate_id: id },
    });
    
    if (splitRules) {
      // 有相关记录，不允许物理删除，改为标记为非活跃
      return next(
        new AppError(
          '该室友有相关账单记录，无法删除。请使用更新接口将其标记为非活跃状态',
          400,
          ERROR_CODES.INVALID_INPUT
        )
      );
    }
    
    await flatmate.destroy();
    
    res.json({
      success: true,
      message: '室友已删除',
    });
  });

  static getBalance = wrapAsync(async (req, res, next) => {
    const { id } = req.params;
    const { start_date, end_date } = req.query;
    
    const flatmate = await Flatmate.findOne({
      where: { id },
    });
    
    if (!flatmate) {
      return next(new AppError('室友不存在', 404, ERROR_CODES.FLATMATE_NOT_FOUND));
    }
    
    // 计算余额
    const splitRules = await SplitRule.findAll({
      where: {
        flatmate_id: id,
        ...(start_date && { created_at: { $gte: new Date(start_date) } }),
        ...(end_date && { created_at: { $lte: new Date(end_date) } }),
      },
    });
    
    let totalAmount = 0;
    let totalPaid = 0;
    let totalPointsUsed = 0;
    
    for (const rule of splitRules) {
      totalAmount += parseFloat(rule.amount);
      totalPaid += parseFloat(rule.paid_amount);
      totalPointsUsed += parseFloat(rule.points_used);
    }
    
    const balance = {
      flatmate_id: flatmate.id,
      name: flatmate.name,
      points: flatmate.points,
      points_value: (flatmate.points * 0.1).toFixed(2),
      total_amount: totalAmount.toFixed(2),
      total_paid: totalPaid.toFixed(2),
      total_points_used: totalPointsUsed.toFixed(2),
      outstanding: (totalAmount - totalPaid).toFixed(2),
      time_range: {
        start: start_date || null,
        end: end_date || null,
      },
    };
    
    res.json({
      success: true,
      data: {
        balance,
      },
    });
  });
}

module.exports = FlatmateController;
