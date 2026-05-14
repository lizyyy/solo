const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const CallRecord = sequelize.define('CallRecord', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  CustomerId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  ApiEndpointId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  CustomerPackageId: {
    type: DataTypes.INTEGER
  },
  requestId: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  idempotencyKey: {
    type: DataTypes.STRING
  },
  status: {
    type: DataTypes.ENUM('success', 'pending_review', 'blocked', 'retryable', 'failed'),
    allowNull: false
  },
  retryCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  burstDetected: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  overQuota: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  cost: {
    type: DataTypes.INTEGER,
    defaultValue: 1
  },
  responseTime: {
    type: DataTypes.INTEGER
  },
  errorMessage: {
    type: DataTypes.TEXT
  },
  reviewed: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  corrected: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  correctionReason: {
    type: DataTypes.TEXT
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  updatedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
});

module.exports = CallRecord;
