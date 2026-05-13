"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createNotification = createNotification;
exports.simulateSendNotification = simulateSendNotification;
exports.acknowledgeNotification = acknowledgeNotification;
exports.retryNotification = retryNotification;
exports.generateRiskAlertNotifications = generateRiskAlertNotifications;
exports.generateRebookingInitiatedNotifications = generateRebookingInitiatedNotifications;
exports.generateRebookingCompletedNotifications = generateRebookingCompletedNotifications;
exports.generateEventCancelledNotifications = generateEventCancelledNotifications;
exports.queryNotifications = queryNotifications;
const uuid_1 = require("uuid");
const storage_1 = require("../storage");
function generateNumber(prefix) {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `${prefix}-${timestamp}-${random}`;
}
function createNotification(params) {
    const now = new Date().toISOString();
    const notification = {
        notificationId: (0, uuid_1.v4)(),
        notificationNumber: generateNumber('NTF'),
        eventId: params.eventId || null,
        rebookingId: params.rebookingId || null,
        orderId: params.orderId || null,
        recipientId: params.recipientId,
        recipientType: params.recipientType,
        recipientName: params.recipientName,
        recipientContact: params.recipientContact,
        type: params.type,
        channel: params.channel,
        title: params.title,
        content: params.content,
        status: 'PENDING',
        sentAt: null,
        deliveredAt: null,
        acknowledgedAt: null,
        acknowledgedBy: null,
        acknowledgementNote: null,
        createdAt: now,
        updatedAt: now,
        retryCount: 0,
        maxRetries: 3,
        lastError: null
    };
    return storage_1.storage.createNotification(notification);
}
function simulateSendNotification(notificationId, failProbability = 0) {
    const notification = storage_1.storage.getNotification(notificationId);
    if (!notification) {
        return { success: false, error: 'Notification not found' };
    }
    if (failProbability > 0 && Math.random() < failProbability) {
        notification.status = 'FAILED';
        notification.retryCount += 1;
        notification.lastError = 'Simulated send failure for testing';
        notification.updatedAt = new Date().toISOString();
        storage_1.storage.updateNotification(notification);
        return { success: false, error: notification.lastError };
    }
    const now = new Date().toISOString();
    notification.status = 'SENT';
    notification.sentAt = now;
    notification.updatedAt = now;
    storage_1.storage.updateNotification(notification);
    setTimeout(() => {
        const n = storage_1.storage.getNotification(notificationId);
        if (n && n.status === 'SENT') {
            n.status = 'DELIVERED';
            n.deliveredAt = new Date().toISOString();
            n.updatedAt = new Date().toISOString();
            storage_1.storage.updateNotification(n);
        }
    }, 1000);
    return { success: true };
}
function acknowledgeNotification(notificationId, acknowledgedBy, note) {
    const notification = storage_1.storage.getNotification(notificationId);
    if (!notification)
        return null;
    const now = new Date().toISOString();
    notification.status = 'ACKNOWLEDGED';
    notification.acknowledgedAt = now;
    notification.acknowledgedBy = acknowledgedBy;
    notification.acknowledgementNote = note || null;
    notification.updatedAt = now;
    return storage_1.storage.updateNotification(notification);
}
function retryNotification(notificationId) {
    const notification = storage_1.storage.getNotification(notificationId);
    if (!notification)
        return null;
    if (notification.retryCount >= notification.maxRetries) {
        return null;
    }
    const result = simulateSendNotification(notificationId);
    return storage_1.storage.getNotification(notificationId) || null;
}
function generateRiskAlertNotifications(event) {
    const notifications = [];
    const now = new Date();
    for (const assessedSite of event.assessedSites) {
        if (['CRITICAL', 'HIGH', 'MEDIUM'].includes(assessedSite.assessedRiskLevel)) {
            const orders = storage_1.storage.getOrdersBySite(assessedSite.siteId);
            for (const order of orders) {
                const notification = createNotification({
                    eventId: event.eventId,
                    orderId: order.orderId,
                    recipientId: order.orderId,
                    recipientType: 'CUSTOMER',
                    recipientName: order.customerName,
                    recipientContact: `customer-${order.orderId}@example.com`,
                    type: 'RISK_ALERT',
                    channel: 'EMAIL',
                    title: '暴雨预警 - 营位风险通知',
                    content: `尊敬的${order.customerName}：\n\n` +
                        `接获气象部门暴雨预警，您预订的营位 ${assessedSite.siteNumber} 存在 ${assessedSite.assessedRiskLevel} 级风险。\n` +
                        `风险等级：${assessedSite.assessedRiskLevel}\n` +
                        `评估说明：${assessedSite.assessmentReason}\n\n` +
                        `我们的工作人员将尽快与您联系协调改签事宜。\n\n` +
                        `露营地管理处\n${now.toLocaleString('zh-CN')}`
                });
                notifications.push(notification);
            }
        }
    }
    const highRiskCount = event.assessedSites.filter(s => ['CRITICAL', 'HIGH'].includes(s.assessedRiskLevel)).length;
    if (highRiskCount > 0) {
        const staffNotification = createNotification({
            eventId: event.eventId,
            recipientId: 'camp-staff-001',
            recipientType: 'CAMP_STAFF',
            recipientName: '营地值班经理',
            recipientContact: 'staff@campground.com',
            type: 'CAMP_STAFF_ALERT',
            channel: 'APP_PUSH',
            title: '紧急：暴雨风险营位需处理',
            content: `暴雨预警触发，${highRiskCount} 个营位存在高风险（CRITICAL/HIGH）。\n\n` +
                `事件编号：${event.eventNumber}\n` +
                `预警类型：${event.weatherAlert.alertType}\n` +
                `严重程度：${event.weatherAlert.severity}\n` +
                `受影响订单数：${event.affectedOrders.length}\n\n` +
                `请立即协调营位改签和客户通知工作。`
        });
        notifications.push(staffNotification);
    }
    return notifications;
}
function generateRebookingInitiatedNotifications(event, rebookingId, order, availableSitesCount) {
    const notifications = [];
    const now = new Date();
    const customerNotification = createNotification({
        eventId: event.eventId,
        rebookingId,
        orderId: order.orderId,
        recipientId: order.orderId,
        recipientType: 'CUSTOMER',
        recipientName: order.customerName,
        recipientContact: `customer-${order.orderId}@example.com`,
        type: 'REBOOKING_INITIATED',
        channel: 'SMS',
        title: '营位改签通知',
        content: `尊敬的${order.customerName}：\n\n` +
            `由于暴雨预警，我们已为您启动营位改签流程。\n\n` +
            `原营位：${storage_1.storage.getSite(order.siteId)?.siteNumber || '未知'}\n` +
            `可选择替代营位数：${availableSitesCount}\n\n` +
            `我们的工作人员将在 30 分钟内与您电话确认。\n\n` +
            `露营地管理处\n${now.toLocaleString('zh-CN')}`
    });
    notifications.push(customerNotification);
    const staffNotification = createNotification({
        eventId: event.eventId,
        rebookingId,
        recipientId: 'camp-staff-001',
        recipientType: 'CAMP_STAFF',
        recipientName: '营地值班经理',
        recipientContact: 'staff@campground.com',
        type: 'CAMP_STAFF_ALERT',
        channel: 'IN_APP',
        title: '待处理改签',
        content: `客户 ${order.customerName} 的改签已启动，请尽快处理。\n\n` +
            `订单号：${order.orderNumber}\n` +
            `原营位：${storage_1.storage.getSite(order.siteId)?.siteNumber || '未知'}\n` +
            `客人数：${order.guestCount}\n` +
            `入住状态：${order.isCheckedin ? '已入住' : '未入住'}`
    });
    notifications.push(staffNotification);
    return notifications;
}
function generateRebookingCompletedNotifications(event, rebookingId, order, originalSiteNumber, targetSiteNumber) {
    const notifications = [];
    const now = new Date();
    const customerNotification = createNotification({
        eventId: event.eventId,
        rebookingId,
        orderId: order.orderId,
        recipientId: order.orderId,
        recipientType: 'CUSTOMER',
        recipientName: order.customerName,
        recipientContact: `customer-${order.orderId}@example.com`,
        type: 'REBOOKING_COMPLETED',
        channel: 'EMAIL',
        title: '营位改签完成确认',
        content: `尊敬的${order.customerName}：\n\n` +
            `您的营位改签已完成！\n\n` +
            `原营位：${originalSiteNumber}\n` +
            `新营位：${targetSiteNumber}\n` +
            `订单号：${order.orderNumber}\n\n` +
            `如需进一步协助，请联系营地工作人员。\n\n` +
            `感谢您的理解与配合！\n` +
            `露营地管理处\n${now.toLocaleString('zh-CN')}`
    });
    notifications.push(customerNotification);
    return notifications;
}
function generateEventCancelledNotifications(event) {
    const notifications = [];
    const now = new Date();
    const staffNotification = createNotification({
        eventId: event.eventId,
        recipientId: 'camp-staff-001',
        recipientType: 'CAMP_STAFF',
        recipientName: '营地值班经理',
        recipientContact: 'staff@campground.com',
        type: 'EVENT_CANCELLED',
        channel: 'APP_PUSH',
        title: '风险事件已取消',
        content: `风险事件已取消。\n\n` +
            `事件编号：${event.eventNumber}\n` +
            `预警类型：${event.weatherAlert.alertType}\n\n` +
            `营位风险等级已恢复。`
    });
    notifications.push(staffNotification);
    return notifications;
}
function queryNotifications(filters) {
    let notifications = storage_1.storage.getAllNotifications();
    if (filters.eventId) {
        notifications = notifications.filter(n => n.eventId === filters.eventId);
    }
    if (filters.status) {
        notifications = notifications.filter(n => n.status === filters.status);
    }
    if (filters.recipientType) {
        notifications = notifications.filter(n => n.recipientType === filters.recipientType);
    }
    if (filters.type) {
        notifications = notifications.filter(n => n.type === filters.type);
    }
    return notifications.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}
//# sourceMappingURL=notificationService.js.map