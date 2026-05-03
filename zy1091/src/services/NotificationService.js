const { Op } = require('sequelize');
const moment = require('moment');
const {
  Notification,
  Flatmate,
  Bill,
  PaymentRecord,
  ChoreTask,
  Dispute,
} = require('../models');

class NotificationService {
  static async createNotification(notificationData) {
    const notification = await Notification.create({
      recipient_id: notificationData.recipient_id,
      notification_type: notificationData.notification_type,
      title: notificationData.title,
      content: notificationData.content || '',
      is_read: notificationData.is_read || false,
      is_urgent: notificationData.is_urgent || false,
      bill_id: notificationData.bill_id || null,
      payment_id: notificationData.payment_id || null,
      task_id: notificationData.task_id || null,
      dispute_id: notificationData.dispute_id || null,
      action_url: notificationData.action_url || null,
      is_system_generated: notificationData.is_system_generated !== false,
      created_by_id: notificationData.created_by_id || null,
      expires_at: notificationData.expires_at || null,
    });
    
    return notification;
  }

  static async getNotifications(recipientId, options = {}) {
    const { is_read, limit = 20, offset = 0, include_urgent_first = true } = options;
    
    const whereClause = {
      recipient_id: recipientId,
    };
    
    if (is_read !== undefined) {
      whereClause.is_read = is_read;
    }
    
    // 过滤过期的通知
    const now = moment();
    whereClause[Op.or] = [
      { expires_at: { [Op.is]: null } },
      { expires_at: { [Op.gt]: now.toDate() } },
    ];
    
    const order = [];
    if (include_urgent_first) {
      order.push(['is_urgent', 'DESC']);
    }
    order.push(['created_at', 'DESC']);
    
    const notifications = await Notification.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: Bill,
          as: 'bill',
          attributes: ['id', 'title', 'status'],
          required: false,
        },
        {
          model: PaymentRecord,
          as: 'payment',
          attributes: ['id', 'amount', 'status'],
          required: false,
        },
        {
          model: ChoreTask,
          as: 'task',
          attributes: ['id', 'title', 'status'],
          required: false,
        },
        {
          model: Dispute,
          as: 'dispute',
          attributes: ['id', 'title', 'status'],
          required: false,
        },
      ],
      order,
      limit,
      offset,
    });
    
    const unreadCount = await Notification.count({
      where: {
        recipient_id: recipientId,
        is_read: false,
        [Op.or]: [
          { expires_at: { [Op.is]: null } },
          { expires_at: { [Op.gt]: now.toDate() } },
        ],
      },
    });
    
    return {
      total: notifications.count,
      unread_count: unreadCount,
      items: notifications.rows,
      limit,
      offset,
    };
  }

  static async markAsRead(notificationId, recipientId) {
    const notification = await Notification.findOne({
      where: {
        id: notificationId,
        recipient_id: recipientId,
      },
    });
    
    if (!notification) {
      throw new Error('通知不存在或无权访问');
    }
    
    if (notification.is_read) {
      return notification;
    }
    
    await notification.update({
      is_read: true,
      read_at: moment().toDate(),
    });
    
    return notification;
  }

  static async markAllAsRead(recipientId) {
    const result = await Notification.update(
      {
        is_read: true,
        read_at: moment().toDate(),
      },
      {
        where: {
          recipient_id: recipientId,
          is_read: false,
        },
      }
    );
    
    return {
      marked_count: result[0],
    };
  }

  static async deleteNotification(notificationId, recipientId) {
    const notification = await Notification.findOne({
      where: {
        id: notificationId,
        recipient_id: recipientId,
      },
    });
    
    if (!notification) {
      throw new Error('通知不存在或无权访问');
    }
    
    await notification.destroy();
    
    return { success: true };
  }

  static async getNotificationSummary(recipientId) {
    const now = moment();
    const threeDaysAgo = moment().subtract(3, 'days');
    
    // 未读数量
    const unreadCount = await Notification.count({
      where: {
        recipient_id: recipientId,
        is_read: false,
        [Op.or]: [
          { expires_at: { [Op.is]: null } },
          { expires_at: { [Op.gt]: now.toDate() } },
        ],
      },
    });
    
    // 紧急未读数量
    const urgentUnreadCount = await Notification.count({
      where: {
        recipient_id: recipientId,
        is_read: false,
        is_urgent: true,
        [Op.or]: [
          { expires_at: { [Op.is]: null } },
          { expires_at: { [Op.gt]: now.toDate() } },
        ],
      },
    });
    
    // 最近3天的通知类型分布
    const recentNotifications = await Notification.findAll({
      where: {
        recipient_id: recipientId,
        created_at: {
          [Op.gte]: threeDaysAgo.toDate(),
        },
      },
      attributes: ['notification_type'],
    });
    
    const typeDistribution = {};
    for (const notification of recentNotifications) {
      if (!typeDistribution[notification.notification_type]) {
        typeDistribution[notification.notification_type] = 0;
      }
      typeDistribution[notification.notification_type]++;
    }
    
    return {
      unread_count: unreadCount,
      urgent_unread_count: urgentUnreadCount,
      recent_type_distribution: typeDistribution,
    };
  }
}

module.exports = NotificationService;
