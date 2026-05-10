const { DataTypes } = require('sequelize');
const { sequelize } = require('../db');

const AccessLog = sequelize.define('AccessLog', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  shortLinkId: {
    type: DataTypes.UUID,
    allowNull: false,
    index: true,
    references: {
      model: 'short_links',
      key: 'id',
    },
  },
  deviceFingerprintId: {
    type: DataTypes.UUID,
    allowNull: true,
    index: true,
    references: {
      model: 'device_fingerprints',
      key: 'id',
    },
  },
  ipAddress: {
    type: DataTypes.STRING(45),
    allowNull: false,
    index: true,
  },
  userAgent: {
    type: DataTypes.STRING(1024),
    allowNull: true,
  },
  referrer: {
    type: DataTypes.STRING(2048),
    allowNull: true,
  },
  isFraud: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    index: true,
  },
  fraudReason: {
    type: DataTypes.STRING(256),
    allowNull: true,
  },
  fraudScore: {
    type: DataTypes.FLOAT,
    defaultValue: 0,
  },
  isBlacklisted: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  isBot: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  processed: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    index: true,
  },
  processingError: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  retryCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  nextRetryAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  attributes: {
    type: DataTypes.JSONB,
    allowNull: true,
  },
  requestId: {
    type: DataTypes.STRING(64),
    unique: true,
    allowNull: false,
    index: true,
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    index: true,
  },
  updatedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
}, {
  tableName: 'access_logs',
  timestamps: true,
  indexes: [
    { fields: ['shortLinkId'] },
    { fields: ['ipAddress'] },
    { fields: ['isFraud'] },
    { fields: ['processed'] },
    { fields: ['createdAt'] },
    { fields: ['requestId'], unique: true },
  ],
});

module.exports = AccessLog;
