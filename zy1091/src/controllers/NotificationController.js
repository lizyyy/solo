const { Notification, Flatmate } = require('../models');
const { NotificationService } = require('../services');
const { wrapAsync, AppError } = require('../middlewares');
const { ERROR_CODES } = require('../config/constants');

class NotificationController {
  static getMyNotifications = wrapAsync(async (req, res, next) => {
    const userId = req.headers['x-user-id'] || 1;
    const { is_read, limit = 20, offset = 0, include_urgent_first = true } = req.query;
    
    try {
      const result = await NotificationService.getNotifications(
        parseInt(userId),
        {
          is_read: is_read === 'true' ? true : (is_read === 'false' ? false : undefined),
          limit: parseInt(limit),
          offset: parseInt(offset),
          include_urgent_first: include_urgent_first !== 'false',
        }
      );
      
      res.json({
        success: true,
        data: {
          notifications: result.items,
          total: result.total,
          unread_count: result.unread_count,
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
    const userId = req.headers['x-user-id'] || 1;
    
    const notification = await Notification.findOne({
      where: {
        id,
        recipient_id: parseInt(userId),
      },
      include: [
        {
          model: Flatmate,
          as: 'recipient',
          attributes: ['id', 'name'],
        },
      ],
    });
    
    if (!notification) {
      return next(new AppError('通知不存在或无权访问', 404, ERROR_CODES.NOT_FOUND));
    }
    
    res.json({
      success: true,
      data: {
        notification,
      },
    });
  });

  static markAsRead = wrapAsync(async (req, res, next) => {
    const { id } = req.params;
    const userId = req.headers['x-user-id'] || 1;
    
    try {
      const notification = await NotificationService.markAsRead(
        parseInt(id),
        parseInt(userId)
      );
      
      res.json({
        success: true,
        data: {
          notification,
        },
        message: '通知已标记为已读',
      });
    } catch (error) {
      if (error.message && error.message.includes('不存在')) {
        return next(new AppError(error.message, 404, ERROR_CODES.NOT_FOUND));
      }
      next(error);
    }
  });

  static markAllAsRead = wrapAsync(async (req, res, next) => {
    const userId = req.headers['x-user-id'] || 1;
    
    try {
      const result = await NotificationService.markAllAsRead(parseInt(userId));
      
      res.json({
        success: true,
        data: {
          marked_count: result.marked_count,
        },
        message: result.marked_count > 0 
          ? `已标记 ${result.marked_count} 条通知为已读` 
          : '没有未读通知',
      });
    } catch (error) {
      next(error);
    }
  });

  static delete = wrapAsync(async (req, res, next) => {
    const { id } = req.params;
    const userId = req.headers['x-user-id'] || 1;
    
    try {
      await NotificationService.deleteNotification(
        parseInt(id),
        parseInt(userId)
      );
      
      res.json({
        success: true,
        message: '通知已删除',
      });
    } catch (error) {
      if (error.message && error.message.includes('不存在')) {
        return next(new AppError(error.message, 404, ERROR_CODES.NOT_FOUND));
      }
      next(error);
    }
  });

  static getSummary = wrapAsync(async (req, res, next) => {
    const userId = req.headers['x-user-id'] || 1;
    
    try {
      const summary = await NotificationService.getNotificationSummary(parseInt(userId));
      
      res.json({
        success: true,
        data: {
          summary,
        },
        alerts: {
          has_urgent_unread: summary.urgent_unread_count > 0,
          urgent_unread_count: summary.urgent_unread_count,
        },
      });
    } catch (error) {
      next(error);
    }
  });

  // 管理员创建通知
  static create = wrapAsync(async (req, res, next) => {
    const { 
      recipient_id, 
      notification_type, 
      title, 
      content,
      is_urgent,
      action_url,
      expires_at,
      bill_id,
      payment_id,
      task_id,
      dispute_id
    } = req.body;
    
    const creatorId = req.headers['x-user-id'] || 1;
    
    // 验证是否是管理员
    const admin = await Flatmate.findOne({
      where: { id: parseInt(creatorId), is_admin: true },
    });
    
    if (!admin) {
      return next(new AppError('只有管理员可以创建通知', 403, ERROR_CODES.FORBIDDEN));
    }
    
    // 验证接收人
    const recipient = await Flatmate.findOne({
      where: { id: recipient_id },
    });
    
    if (!recipient) {
      return next(new AppError('接收人不存在', 404, ERROR_CODES.FLATMATE_NOT_FOUND));
    }
    
    try {
      const notification = await NotificationService.createNotification({
        recipient_id,
        notification_type: notification_type || 'other',
        title,
        content,
        is_urgent: is_urgent || false,
        action_url,
        is_system_generated: false,
        created_by_id: parseInt(creatorId),
        expires_at,
        bill_id,
        payment_id,
        task_id,
        dispute_id,
      });
      
      res.status(201).json({
        success: true,
        data: {
          notification,
        },
        message: '通知创建成功',
      });
    } catch (error) {
      next(error);
    }
  });

  // 批量删除已读通知
  static deleteRead = wrapAsync(async (req, res, next) => {
    const userId = req.headers['x-user-id'] || 1;
    const { before_date } = req.query;
    
    const whereClause = {
      recipient_id: parseInt(userId),
      is_read: true,
    };
    
    if (before_date) {
      whereClause.created_at = {
        $lt: new Date(before_date),
      };
    }
    
    const deletedCount = await Notification.destroy({
      where: whereClause,
    });
    
    res.json({
      success: true,
      data: {
        deleted_count: deletedCount,
      },
      message: deletedCount > 0 
        ? `已删除 ${deletedCount} 条已读通知` 
        : '没有可删除的通知',
    });
  });
}

module.exports = NotificationController;
