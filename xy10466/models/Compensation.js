const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Compensation = sequelize.define('Compensation', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  complaintId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Complaints',
      key: 'id'
    }
  },
  orderId: {
    type: DataTypes.STRING,
    allowNull: false,
    references: {
      model: 'Orders',
      key: 'id'
    }
  },
  type: {
    type: DataTypes.ENUM('refund', 'coupon', 'discount', 'apology', 'none'),
    allowNull: false
  },
  amount: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  status: {
    type: DataTypes.ENUM('suggested', 'approved', 'executed', 'rejected'),
    defaultValue: 'suggested'
  },
  suggestedBy: {
    type: DataTypes.STRING,
    defaultValue: 'system'
  },
  approvedBy: {
    type: DataTypes.STRING,
    allowNull: true
  },
  responsibility: {
    type: DataTypes.ENUM('restaurant', 'rider', 'platform', 'customer', 'unknown'),
    defaultValue: 'unknown'
  }
}, {
  timestamps: true
});

module.exports = Compensation;
