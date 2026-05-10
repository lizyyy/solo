const { DataTypes } = require('sequelize');
const { sequelize } = require('../db');

const DeviceFingerprint = sequelize.define('DeviceFingerprint', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  fingerprint: {
    type: DataTypes.STRING(128),
    unique: true,
    allowNull: false,
    index: true,
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
  acceptLanguage: {
    type: DataTypes.STRING(128),
    allowNull: true,
  },
  acceptEncoding: {
    type: DataTypes.STRING(128),
    allowNull: true,
  },
  screenResolution: {
    type: DataTypes.STRING(32),
    allowNull: true,
  },
  timezone: {
    type: DataTypes.STRING(64),
    allowNull: true,
  },
  platform: {
    type: DataTypes.STRING(128),
    allowNull: true,
  },
  browser: {
    type: DataTypes.STRING(64),
    allowNull: true,
  },
  browserVersion: {
    type: DataTypes.STRING(32),
    allowNull: true,
  },
  os: {
    type: DataTypes.STRING(64),
    allowNull: true,
  },
  osVersion: {
    type: DataTypes.STRING(32),
    allowNull: true,
  },
  isMobile: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  isBot: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  firstSeenAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  lastSeenAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  totalRequests: {
    type: DataTypes.INTEGER,
    defaultValue: 1,
  },
  fingerprintData: {
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
  tableName: 'device_fingerprints',
  timestamps: true,
  indexes: [
    { fields: ['ipAddress'] },
    { fields: ['isBot'] },
    { fields: ['lastSeenAt'] },
  ],
});

module.exports = DeviceFingerprint;
