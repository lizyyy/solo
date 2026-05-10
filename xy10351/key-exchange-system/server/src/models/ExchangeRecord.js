const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ExchangeRecord = sequelize.define('ExchangeRecord', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  keyId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  orderId: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  type: {
    type: DataTypes.ENUM('pickup', 'return', 'temporary_borrow'),
    allowNull: false,
  },
  operator: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  operatorRole: {
    type: DataTypes.ENUM('cleaner', 'admin', 'supervisor'),
    allowNull: false,
  },
  timestamp: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  expectedReturnTime: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  actualReturnTime: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  isOverdue: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  remarks: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  status: {
    type: DataTypes.ENUM('active', 'completed', 'cancelled', 'modified'),
    defaultValue: 'active',
  },
  relatedRecordId: {
    type: DataTypes.UUID,
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
});

module.exports = ExchangeRecord;
