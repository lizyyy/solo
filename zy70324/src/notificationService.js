const nodemailer = require('nodemailer');

class NotificationService {
  constructor(config, db) {
    this.config = config;
    this.db = db;
    this.transporter = null;

    if (config.enabled && config.email) {
      this.transporter = nodemailer.createTransport({
        host: config.email.host,
        port: config.email.port,
        secure: config.email.secure,
        auth: {
          user: config.email.user,
          pass: config.email.pass,
        },
      });
    }
  }

  async sendCertificateExpiryWarning(customer, callbackUrl, daysRemaining) {
    const notificationData = {
      customerId: customer.id,
      callbackUrlId: callbackUrl.id,
      type: 'certificate_expiry_warning',
      severity: 'warning',
      title: '证书即将过期提醒',
      message: `您的回调地址 ${callbackUrl.url} 的证书将在 ${daysRemaining} 天后过期，请及时更新。`,
    };

    return this._sendNotification(customer, notificationData);
  }

  async sendCertificateExpired(customer, callbackUrl) {
    const notificationData = {
      customerId: customer.id,
      callbackUrlId: callbackUrl.id,
      type: 'certificate_expired',
      severity: 'critical',
      title: '证书已过期',
      message: `您的回调地址 ${callbackUrl.url} 的证书已过期，事件推送可能会失败。`,
    };

    return this._sendNotification(customer, notificationData);
  }

  async sendConsecutiveFailures(customer, callbackUrl, failureCount) {
    const notificationData = {
      customerId: customer.id,
      callbackUrlId: callbackUrl.id,
      type: 'consecutive_failures',
      severity: 'error',
      title: '回调地址连续失败告警',
      message: `您的回调地址 ${callbackUrl.url} 已连续失败 ${failureCount} 次，请检查服务是否正常。`,
    };

    return this._sendNotification(customer, notificationData);
  }

  async sendSlowResponse(customer, callbackUrl, responseTimeMs) {
    const notificationData = {
      customerId: customer.id,
      callbackUrlId: callbackUrl.id,
      type: 'slow_response',
      severity: 'warning',
      title: '回调地址响应缓慢',
      message: `您的回调地址 ${callbackUrl.url} 响应时间为 ${responseTimeMs}ms，超过正常阈值。`,
    };

    return this._sendNotification(customer, notificationData);
  }

  async sendBlocked(customer, callbackUrl) {
    const notificationData = {
      customerId: customer.id,
      callbackUrlId: callbackUrl.id,
      type: 'blocked',
      severity: 'critical',
      title: '回调地址已被封禁',
      message: `您的回调地址 ${callbackUrl.url} 因连续失败次数过多已被封禁，请修复后联系平台解除封禁。`,
    };

    return this._sendNotification(customer, notificationData);
  }

  async _sendNotification(customer, notificationData) {
    let delivered = false;
    let deliveryError = null;

    if (this.config.enabled && this.transporter && customer.email) {
      try {
        const mailOptions = {
          from: this.config.email.from,
          to: customer.email,
          subject: notificationData.title,
          text: notificationData.message,
          html: `<p>${notificationData.message}</p>`,
        };

        await this.transporter.sendMail(mailOptions);
        delivered = true;
      } catch (error) {
        console.error('Failed to send notification:', error);
        deliveryError = error.message;
      }
    } else {
      console.log('Notification would be sent:', notificationData);
      delivered = true;
    }

    return this.db.createNotification({
      ...notificationData,
      delivered,
      deliveryError,
    });
  }
}

module.exports = NotificationService;