const REMINDER_TYPE = {
  AUTO: 'auto',
  MANUAL: 'manual'
};

const REMINDER_CHANNEL = {
  EMAIL: 'email',
  SMS: 'sms',
  IN_APP: 'in_app',
  WECHAT: 'wechat'
};

const REMINDER_STATUS = {
  PENDING: 'pending',
  SENT: 'sent',
  FAILED: 'failed',
  READ: 'read'
};

class ReminderRecord {
  constructor(data) {
    this.id = data.id;
    this.borrowRecordId = data.borrowRecordId;
    this.userId = data.userId;
    this.userName = data.userName;
    this.type = data.type || REMINDER_TYPE.AUTO;
    this.channel = data.channel || REMINDER_CHANNEL.IN_APP;
    this.status = data.status || REMINDER_STATUS.PENDING;
    this.content = data.content;
    this.sentAt = data.sentAt || null;
    this.readAt = data.readAt || null;
    this.remark = data.remark || '';
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
  }

  toJSON() {
    return {
      id: this.id,
      borrowRecordId: this.borrowRecordId,
      userId: this.userId,
      userName: this.userName,
      type: this.type,
      typeText: this.getTypeText(),
      channel: this.channel,
      channelText: this.getChannelText(),
      status: this.status,
      statusText: this.getStatusText(),
      content: this.content,
      sentAt: this.sentAt,
      readAt: this.readAt,
      remark: this.remark,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  getTypeText() {
    const map = {
      [REMINDER_TYPE.AUTO]: '自动催还',
      [REMINDER_TYPE.MANUAL]: '手动催还'
    };
    return map[this.type] || this.type;
  }

  getChannelText() {
    const map = {
      [REMINDER_CHANNEL.EMAIL]: '邮件',
      [REMINDER_CHANNEL.SMS]: '短信',
      [REMINDER_CHANNEL.IN_APP]: '站内通知',
      [REMINDER_CHANNEL.WECHAT]: '微信'
    };
    return map[this.channel] || this.channel;
  }

  getStatusText() {
    const map = {
      [REMINDER_STATUS.PENDING]: '待发送',
      [REMINDER_STATUS.SENT]: '已发送',
      [REMINDER_STATUS.FAILED]: '发送失败',
      [REMINDER_STATUS.READ]: '已读'
    };
    return map[this.status] || this.status;
  }
}

module.exports = { ReminderRecord, REMINDER_TYPE, REMINDER_CHANNEL, REMINDER_STATUS };
