const { v4: uuidv4 } = require('uuid');
const storage = require('../models/storage');
const eventBus = require('../utils/eventBus');

class NotificationService {
  constructor() {
    this.sentNotifications = new Map();
  }

  _shouldSend(customerKey, notificationType) {
    const key = `${customerKey}_${notificationType}`;
    const now = Date.now();
    const windowMs = 5 * 60 * 1000;

    if (!this.sentNotifications.has(key)) {
      this.sentNotifications.set(key, { lastSent: 0, count: 0 });
    }

    const record = this.sentNotifications.get(key);
    
    if (now - record.lastSent < windowMs && record.count >= 2) {
      return false;
    }

    return true;
  }

  _recordSent(customerKey, notificationType) {
    const key = `${customerKey}_${notificationType}`;
    const record = this.sentNotifications.get(key) || { lastSent: 0, count: 0 };
    record.lastSent = Date.now();
    record.count++;
    this.sentNotifications.set(key, record);
  }

  sendNotification(ticketId, notificationType, message, extraData = {}) {
    const queue = storage.getQueue();
    const ticket = queue.find(t => t.id === ticketId);
    
    if (!ticket) {
      throw new Error('未找到该排队号码');
    }

    const customerKey = ticket.phone || ticket.customerName;
    
    if (!this._shouldSend(customerKey, notificationType)) {
      return {
        success: false,
        duplicate: true,
        message: '通知发送频率过高，已去重'
      };
    }

    const notification = {
      id: uuidv4(),
      ticketId,
      queueNumber: ticket.queueNumber,
      customerName: ticket.customerName,
      phone: ticket.phone,
      type: notificationType,
      message,
      extraData,
      sentAt: new Date().toISOString(),
      status: 'SENT'
    };

    ticket.notifications = ticket.notifications || [];
    ticket.notifications.push({
      id: notification.id,
      type: notificationType,
      message,
      sentAt: notification.sentAt
    });

    storage.saveQueue(queue);

    const notifications = storage.getNotifications();
    notifications.push(notification);
    storage.saveNotifications(notifications);

    this._recordSent(customerKey, notificationType);

    eventBus.emitEvent('NOTIFICATION.SEND', {
      notificationId: notification.id,
      ticketId,
      customerName: ticket.customerName,
      type: notificationType,
      message
    });

    console.log(`[NOTIFICATION] 发送给${ticket.customerName}: ${message}`);

    return {
      success: true,
      duplicate: false,
      notification
    };
  }

  notifyCalling(ticketId) {
    return this.sendNotification(
      ticketId,
      'CALLING',
      '您的号码已到号，请尽快到前台入座！',
      { priority: 'high' }
    );
  }

  notifyReminder(ticketId, position) {
    return this.sendNotification(
      ticketId,
      'REMINDER',
      `您好，您前面还有${position}桌，请做好准备！`,
      { position }
    );
  }

  notifyOvertime(ticketId, skipCount) {
    const message = skipCount >= 2 
      ? '您已多次过号，排队已取消，请重新取号'
      : '您已过号，可点击恢复排队，会为您优先安排';
    return this.sendNotification(
      ticketId,
      'OVERTIME',
      message,
      { skipCount }
    );
  }

  notifyRestore(ticketId, newPosition) {
    return this.sendNotification(
      ticketId,
      'RESTORE',
      `您已恢复排队，当前位置：第${newPosition}位`,
      { newPosition }
    );
  }

  getNotifications(filters = {}) {
    let notifications = storage.getNotifications();
    
    if (filters.ticketId) {
      notifications = notifications.filter(n => n.ticketId === filters.ticketId);
    }
    if (filters.type) {
      notifications = notifications.filter(n => n.type === filters.type);
    }
    if (filters.startDate) {
      const start = new Date(filters.startDate).getTime();
      notifications = notifications.filter(n => new Date(n.sentAt).getTime() >= start);
    }
    if (filters.endDate) {
      const end = new Date(filters.endDate).getTime();
      notifications = notifications.filter(n => new Date(n.sentAt).getTime() <= end);
    }
    
    return notifications;
  }

  getNotificationStats() {
    const notifications = storage.getNotifications();
    const stats = {
      total: notifications.length,
      byType: {},
      today: 0
    };

    const today = new Date().toDateString();
    
    notifications.forEach(n => {
      stats.byType[n.type] = (stats.byType[n.type] || 0) + 1;
      if (new Date(n.sentAt).toDateString() === today) {
        stats.today++;
      }
    });

    return stats;
  }
}

module.exports = new NotificationService();
