const { v4: uuidv4 } = require('uuid');
const { Notification, NotificationType, NotificationStatus } = require('../models/Notification');
const { Material } = require('../models/Material');
const RuleEngine = require('./RuleEngine');

class NotificationService {
  constructor() {
    this.ruleEngine = new RuleEngine();
  }

  async createNotification(type, authorization, recipient, customContent = null) {
    const notificationCode = `NOT-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
    
    const material = await Material.findByPk(authorization.materialId);
    const materialName = material ? material.materialName : '未知素材';

    const templates = {
      [NotificationType.EXPIRATION_WARNING]: {
        subject: `【到期预警】素材「${materialName}」授权即将到期`,
        content: `
尊敬的用户：

您的素材「${materialName}」授权即将到期，请注意及时处理。

授权编号：${authorization.authorizationCode}
渠道：${authorization.channelName}
到期日期：${authorization.expirationDate}

请尽快安排续费或下架操作，避免版权风险。

版权授权管理系统
        `.trim()
      },
      [NotificationType.EXPIRED]: {
        subject: `【已到期】素材「${materialName}」授权已到期`,
        content: `
尊敬的用户：

您的素材「${materialName}」授权已到期，系统已自动触发下架流程。

授权编号：${authorization.authorizationCode}
渠道：${authorization.channelName}
到期日期：${authorization.expirationDate}

如需继续使用，请联系版权方重新授权。

版权授权管理系统
        `.trim()
      },
      [NotificationType.REVOKED]: {
        subject: `【已撤销】素材「${materialName}」授权已被撤销`,
        content: `
尊敬的用户：

您的素材「${materialName}」授权已被撤销，系统已自动触发下架流程。

授权编号：${authorization.authorizationCode}
渠道：${authorization.channelName}
撤销时间：${authorization.revokedAt || new Date()}
撤销原因：${authorization.revocationReason || '未说明'}

如有疑问，请联系版权授权管理团队。

版权授权管理系统
        `.trim()
      },
      [NotificationType.REGION_VIOLATION]: {
        subject: `【地域违规】素材「${materialName}」存在地域使用违规`,
        content: `
尊敬的用户：

您的素材「${materialName}」存在地域使用违规情况。

授权编号：${authorization.authorizationCode}
渠道：${authorization.channelName}
违规详情：${customContent || '请查看授权地域规则'}

请立即停止在违规地区的使用，或联系版权方调整授权范围。

版权授权管理系统
        `.trim()
      },
      [NotificationType.REMOVAL_EXECUTED]: {
        subject: `【下架完成】素材「${materialName}」已完成下架`,
        content: `
尊敬的用户：

您的素材「${materialName}」已完成下架操作。

授权编号：${authorization.authorizationCode}
渠道：${authorization.channelName}
下架时间：${new Date()}

如需重新上架，请确保授权状态有效。

版权授权管理系统
        `.trim()
      }
    };

    const template = templates[type] || templates[NotificationType.EXPIRATION_WARNING];

    return await Notification.create({
      id: uuidv4(),
      notificationCode,
      type,
      authorizationId: authorization.id,
      materialId: authorization.materialId,
      recipient,
      subject: template.subject,
      content: template.content,
      status: NotificationStatus.PENDING,
      createdAt: new Date(),
      updatedAt: new Date()
    });
  }

  async sendExpirationWarnings(daysThreshold = 7, recipient) {
    const checkResult = await this.ruleEngine.checkExpiringAuthorizations(daysThreshold);
    const notifications = [];

    for (const item of checkResult.expiringAuthorizations) {
      const notification = await this.createNotification(
        NotificationType.EXPIRATION_WARNING,
        item.authorization,
        recipient
      );
      notifications.push({
        notificationCode: notification.notificationCode,
        authorizationCode: item.authorization.authorizationCode,
        daysRemaining: item.daysRemaining,
        status: 'CREATED'
      });
    }

    return {
      created: notifications.length,
      notifications,
      evaluationSteps: checkResult.evaluationSteps
    };
  }

  async sendRevocationNotification(authorization, recipient) {
    return await this.createNotification(
      NotificationType.REVOKED,
      authorization,
      recipient
    );
  }

  async sendExpirationNotification(authorization, recipient) {
    return await this.createNotification(
      NotificationType.EXPIRED,
      authorization,
      recipient
    );
  }

  async markAsSent(notificationId) {
    const notification = await Notification.findByPk(notificationId);
    if (!notification) {
      throw new Error('通知不存在');
    }

    return await notification.update({
      status: NotificationStatus.SENT,
      sentAt: new Date()
    });
  }

  async getNotifications(filters = {}, limit = 100, offset = 0) {
    const where = {};
    
    if (filters.type) {
      where.type = filters.type;
    }
    if (filters.status) {
      where.status = filters.status;
    }
    if (filters.authorizationId) {
      where.authorizationId = filters.authorizationId;
    }
    if (filters.materialId) {
      where.materialId = filters.materialId;
    }

    return await Notification.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit,
      offset
    });
  }
}

module.exports = NotificationService;
