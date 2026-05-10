const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const DeliveryReceipt = sequelize.define('DeliveryReceipt', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4
  },
  shortageId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  receiptNo: {
    type: DataTypes.STRING,
    allowNull: false
  },
  deliveryDate: {
    type: DataTypes.DATE,
    allowNull: false
  },
  deliveryQuantity: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false
  },
  batchNo: {
    type: DataTypes.STRING
  },
  qualityStatus: {
    type: DataTypes.ENUM('qualified', 'unqualified', 'inspecting'),
    defaultValue: 'inspecting'
  },
  remark: {
    type: DataTypes.TEXT
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
});

module.exports = DeliveryReceipt;
