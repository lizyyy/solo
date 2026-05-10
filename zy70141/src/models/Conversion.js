const { DataTypes } = require('sequelize');
const { sequelize } = require('../db');

const Conversion = sequelize.define('Conversion', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  accessLogId: {
    type: DataTypes.UUID,
    allowNull: true,
    index: true,
    references: {
      model: 'access_logs',
      key: 'id',
    },
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
  conversionType: {
    type: DataTypes.STRING(64),
    allowNull: false,
    index: true,
  },
  conversionValue: {
    type: DataTypes.DECIMAL(18, 2),
    defaultValue: 0,
  },
  externalOrderId: {
    type: DataTypes.STRING(128),
    allowNull: true,
    unique: true,
  },
  externalUserId: {
    type: DataTypes.STRING(128),
    allowNull: true,
    index: true,
  },
  channel: {
    type: DataTypes.STRING(64),
    allowNull: true,
  },
  ipAddress: {
    type: DataTypes.STRING(45),
    allowNull: true,
    index: true,
  },
  isAttributed: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    index: true,
  },
  attributionModel: {
    type: DataTypes.STRING(64),
    defaultValue: 'first_click',
  },
  attributionWindowEnded: {
    type: DataTypes.DATE,
    allowNull: true,
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
  metadata: {
    type: DataTypes.JSONB,
    allowNull: true,
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  updatedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
}, {
  tableName: 'conversions',
  timestamps: true,
  indexes: [
    { fields: ['externalOrderId'], unique: true },
    { fields: ['shortLinkId'] },
    { fields: ['isAttributed'] },
    { fields: ['processed'] },
    { fields: ['createdAt'] },
  ],
});

module.exports = Conversion;
