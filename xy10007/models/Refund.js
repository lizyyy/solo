const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Refund = sequelize.define('Refund', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  refundNo: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true
  },
  orderId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  reason: {
    type: DataTypes.STRING(500),
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM(
      'pending_review',
      'reviewing',
      'approved',
      'rejected',
      'processing',
      'completed',
      'failed'
    ),
    defaultValue: 'pending_review',
    allowNull: false
  },
  operatorId: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  reviewComment: {
    type: DataTypes.STRING(500),
    allowNull: true
  },
  requestIdempotencyKey: {
    type: DataTypes.STRING(64),
    allowNull: true
  },
  executeIdempotencyKey: {
    type: DataTypes.STRING(64),
    allowNull: true
  },
  version: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    allowNull: false
  }
}, {
  tableName: 'refunds',
  timestamps: true,
  version: 'version'
});

module.exports = Refund;