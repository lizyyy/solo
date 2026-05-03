const { Dispute, Bill, PaymentRecord, ChoreTask, Flatmate } = require('../models');
const { DisputeService } = require('../services');
const { wrapAsync, AppError } = require('../middlewares');
const { ERROR_CODES, STATUS_MAP } = require('../config/constants');

class DisputeController {
  static getAll = wrapAsync(async (req, res, next) => {
    const { 
      status, 
      dispute_type, 
      raised_by, 
      assigned_to,
      limit = 20, 
      offset = 0 
    } = req.query;
    
    try {
      const result = await DisputeService.getDisputes({
        status,
        dispute_type,
        raised_by: raised_by ? parseInt(raised_by) : undefined,
        assigned_to: assigned_to ? parseInt(assigned_to) : undefined,
        limit: parseInt(limit),
        offset: parseInt(offset),
      });
      
      res.json({
        success: true,
        data: {
          disputes: result.items,
          total: result.total,
          limit: result.limit,
          offset: result.offset,
        },
      });
    } catch (error) {
      next(error);
    }
  });

  static getById = wrapAsync(async (req, res, next) => {
    const { id } = req.params;
    
    try {
      const dispute = await DisputeService.getDisputeWithDetails(parseInt(id));
      
      res.json({
        success: true,
        data: {
          dispute,
        },
      });
    } catch (error) {
      if (error.code === ERROR_CODES.DISPUTE_NOT_FOUND) {
        return next(new AppError(error.message, 404, error.code));
      }
      next(error);
    }
  });

  static create = wrapAsync(async (req, res, next) => {
    const raisedById = req.headers['x-user-id'] || 1;
    
    try {
      const dispute = await DisputeService.createDispute(
        req.body,
        parseInt(raisedById)
      );
      
      res.status(201).json({
        success: true,
        data: {
          dispute,
        },
        message: '争议单创建成功，管理员已收到通知',
        alerts: {
          type: 'info',
          message: '您的争议已提交，通常会在24小时内处理',
        },
      });
    } catch (error) {
      if (error.code) {
        const statusCode = error.code === ERROR_CODES.NOT_FOUND ? 404 : 400;
        return next(new AppError(error.message, statusCode, error.code));
      }
      next(error);
    }
  });

  static resolve = wrapAsync(async (req, res, next) => {
    const { id } = req.params;
    const resolvedById = req.headers['x-user-id'] || 1;
    
    // 验证是否是管理员
    const admin = await Flatmate.findOne({
      where: { id: parseInt(resolvedById), is_admin: true },
    });
    
    if (!admin) {
      return next(new AppError('只有管理员可以处理争议', 403, ERROR_CODES.FORBIDDEN));
    }
    
    try {
      const dispute = await DisputeService.resolveDispute(
        parseInt(id),
        req.body,
        parseInt(resolvedById)
      );
      
      res.json({
        success: true,
        data: {
          dispute,
        },
        message: '争议已解决',
      });
    } catch (error) {
      if (error.code) {
        const statusCode = error.code === ERROR_CODES.DISPUTE_NOT_FOUND ? 404 : 400;
        return next(new AppError(error.message, statusCode, error.code));
      }
      next(error);
    }
  });

  static update = wrapAsync(async (req, res, next) => {
    const { id } = req.params;
    const { priority, assigned_to_id, proposed_solution, notes } = req.body;
    const userId = req.headers['x-user-id'] || 1;
    
    const dispute = await Dispute.findOne({
      where: { id },
    });
    
    if (!dispute) {
      return next(new AppError('争议单不存在', 404, ERROR_CODES.DISPUTE_NOT_FOUND));
    }
    
    if (dispute.status === STATUS_MAP.DISPUTE.RESOLVED || 
        dispute.status === STATUS_MAP.DISPUTE.CLOSED) {
      return next(new AppError('争议单已解决或已关闭，无法修改', 400, ERROR_CODES.DISPUTE_ALREADY_RESOLVED));
    }
    
    // 验证是否是管理员或发起人
    const isAdmin = await Flatmate.findOne({
      where: { id: parseInt(userId), is_admin: true },
    });
    
    const isRaiser = dispute.raised_by_id === parseInt(userId);
    
    if (!isAdmin && !isRaiser) {
      return next(new AppError('您没有权限修改此争议单', 403, ERROR_CODES.FORBIDDEN));
    }
    
    // 非管理员只能修改部分字段
    const updateData = {};
    if (isAdmin) {
      updateData.priority = priority;
      updateData.assigned_to_id = assigned_to_id;
      updateData.proposed_solution = proposed_solution;
    }
    if (isRaiser || isAdmin) {
      updateData.notes = notes;
    }
    
    await dispute.update(updateData);
    
    res.json({
      success: true,
      data: {
        dispute,
      },
      message: '争议单更新成功',
    });
  });

  static getMyDisputes = wrapAsync(async (req, res, next) => {
    const userId = req.headers['x-user-id'] || 1;
    const { status, dispute_type, limit = 20, offset = 0 } = req.query;
    
    try {
      const result = await DisputeService.getDisputes({
        raised_by: parseInt(userId),
        status,
        dispute_type,
        limit: parseInt(limit),
        offset: parseInt(offset),
      });
      
      // 统计
      const openCount = await Dispute.count({
        where: {
          raised_by_id: parseInt(userId),
          status: {
            $in: [STATUS_MAP.DISPUTE.OPEN, STATUS_MAP.DISPUTE.UNDER_REVIEW],
          },
        },
      });
      
      const resolvedCount = await Dispute.count({
        where: {
          raised_by_id: parseInt(userId),
          status: STATUS_MAP.DISPUTE.RESOLVED,
        },
      });
      
      res.json({
        success: true,
        data: {
          disputes: result.items,
          total: result.total,
          stats: {
            open_count: openCount,
            resolved_count: resolvedCount,
          },
          limit: result.limit,
          offset: result.offset,
        },
      });
    } catch (error) {
      next(error);
    }
  });

  static getAssignedDisputes = wrapAsync(async (req, res, next) => {
    const userId = req.headers['x-user-id'] || 1;
    const { status, limit = 20, offset = 0 } = req.query;
    
    // 验证是否是管理员
    const admin = await Flatmate.findOne({
      where: { id: parseInt(userId), is_admin: true },
    });
    
    if (!admin) {
      return next(new AppError('只有管理员可以查看分配的争议', 403, ERROR_CODES.FORBIDDEN));
    }
    
    try {
      const result = await DisputeService.getDisputes({
        assigned_to: parseInt(userId),
        status,
        limit: parseInt(limit),
        offset: parseInt(offset),
      });
      
      res.json({
        success: true,
        data: {
          assigned_disputes: result.items,
          total: result.total,
          limit: result.limit,
          offset: result.offset,
        },
      });
    } catch (error) {
      next(error);
    }
  });

  static getDisputeStats = wrapAsync(async (req, res, next) => {
    const userId = req.headers['x-user-id'];
    
    const baseWhere = {};
    if (userId) {
      baseWhere.raised_by_id = parseInt(userId);
    }
    
    // 统计各状态的数量
    const statusStats = {};
    for (const status of Object.values(STATUS_MAP.DISPUTE)) {
      const count = await Dispute.count({
        where: {
          ...baseWhere,
          status,
        },
      });
      statusStats[status] = count;
    }
    
    // 统计各类型的数量
    const typeStats = {};
    const types = ['bill', 'payment', 'chore', 'point'];
    for (const type of types) {
      const count = await Dispute.count({
        where: {
          ...baseWhere,
          dispute_type: type,
        },
      });
      typeStats[type] = count;
    }
    
    res.json({
      success: true,
      data: {
        status_stats: statusStats,
        type_stats: typeStats,
        total: Object.values(statusStats).reduce((a, b) => a + b, 0),
      },
    });
  });
}

module.exports = DisputeController;
