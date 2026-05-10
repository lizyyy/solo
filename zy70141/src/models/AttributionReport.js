const { DataTypes } = require('sequelize');
const { sequelize } = require('../db');

const AttributionReport = sequelize.define('AttributionReport', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  reportDate: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    index: true,
  },
  shortLinkId: {
    type: DataTypes.UUID,
    allowNull: false,
    index: true,
  },
  channel: {
    type: DataTypes.STRING(64),
    allowNull: false,
    index: true,
  },
  campaign: {
    type: DataTypes.STRING(64),
    allowNull: true,
  },
  totalClicks: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  validClicks: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  fraudClicks: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  blockedClicks: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  botClicks: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  uniqueVisitors: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  conversions: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  conversionValue: {
    type: DataTypes.DECIMAL(18, 2),
    defaultValue: 0,
  },
  conversionRate: {
    type: DataTypes.FLOAT,
    defaultValue: 0,
  },
  fraudRate: {
    type: DataTypes.FLOAT,
    defaultValue: 0,
  },
  status: {
    type: DataTypes.ENUM('pending', 'processing', 'completed', 'failed'),
    defaultValue: 'pending',
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
  processedAt: {
    type: DataTypes.DATE,
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
  tableName: 'attribution_reports',
  timestamps: true,
  indexes: [
    { fields: ['reportDate', 'shortLinkId'], unique: true },
    { fields: ['channel'] },
    { fields: ['status'] },
  ],
});

module.exports = AttributionReport;
