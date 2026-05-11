const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Complaint = sequelize.define('Complaint', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  orderId: {
    type: DataTypes.STRING,
    allowNull: false,
    references: {
      model: 'Orders',
      key: 'id'
    }
  },
  complaintContent: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  complaintTime: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  reasonCategory: {
    type: DataTypes.ENUM('dish_issue', 'missing_item', 'delivery_delay', 'package_damage', 'other'),
    allowNull: false
  },
  reasonDetail: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  affectedItems: {
    type: DataTypes.JSON,
    allowNull: true
  },
  severity: {
    type: DataTypes.ENUM('low', 'medium', 'high'),
    defaultValue: 'medium'
  },
  status: {
    type: DataTypes.ENUM('pending', 'processing', 'resolved', 'closed'),
    defaultValue: 'pending'
  },
  isDuplicate: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  originalComplaintId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'Complaints',
      key: 'id'
    }
  }
}, {
  timestamps: true
});

module.exports = Complaint;
