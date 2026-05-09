const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const CountDetail = sequelize.define('CountDetail', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  taskId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  productId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  inventoryId: {
    type: DataTypes.UUID,
    allowNull: true
  },
  systemQuantity: {
    type: DataTypes.DECIMAL(12, 2),
    defaultValue: 0.00
  },
  countQuantity: {
    type: DataTypes.DECIMAL(12, 2),
    defaultValue: 0.00
  },
  differenceQuantity: {
    type: DataTypes.DECIMAL(12, 2),
    defaultValue: 0.00
  },
  countStatus: {
    type: DataTypes.ENUM('pending', 'counted', 'approved', 'rejected'),
    defaultValue: 'pending'
  },
  countedBy: {
    type: DataTypes.UUID,
    allowNull: true
  },
  countedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  remark: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  version: {
    type: DataTypes.INTEGER,
    defaultValue: 1,
    allowNull: false
  }
}, {
  timestamps: true,
  tableName: 'count_details'
});

module.exports = CountDetail;