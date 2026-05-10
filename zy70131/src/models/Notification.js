const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const NotificationType = {
  EXPIRATION_WARNING: 'expiration_warning',
  EXPIRED: 'expired',
  REVOKED: 'revoked',
  REGION_VIOLATION: 'region_violation',
  REMOVAL_EXECUTED: 'removal_executed'
};

const NotificationStatus = {
  PENDING: 'pending',
  SENT: 'sent',
  FAILED: 'failed'
};

const Notification = sequelize.define('Notification', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    allowNull: false
  },
  notificationCode: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
    field: 'notification_code'
  },
  type: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  authorizationId: {
    type: DataTypes.UUID,
    allowNull: true,
    field: 'authorization_id'
  },
  materialId: {
    type: DataTypes.UUID,
    allowNull: true,
    field: 'material_id'
  },
  recipient: {
    type: DataTypes.STRING(200),
    allowNull: false
  },
  subject: {
    type: DataTypes.STRING(200),
    allowNull: false
  },
  content: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  status: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: NotificationStatus.PENDING
  },
  sentAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'sent_at'
  },
  createdAt: {
    type: DataTypes.DATE,
    allowNull: false,
    field: 'created_at'
  },
  updatedAt: {
    type: DataTypes.DATE,
    allowNull: false,
    field: 'updated_at'
  }
}, {
  tableName: 'notifications',
  timestamps: true,
  underscored: true
});

module.exports = { Notification, NotificationType, NotificationStatus };
