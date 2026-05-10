const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const AffectedOrder = sequelize.define('AffectedOrder', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4
  },
  shortageId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  orderNo: {
    type: DataTypes.STRING,
    allowNull: false
  },
  orderType: {
    type: DataTypes.STRING
  },
  orderDate: {
    type: DataTypes.DATE
  },
  requiredDate: {
    type: DataTypes.DATE
  },
  quantity: {
    type: DataTypes.DECIMAL(15, 2)
  },
  customerName: {
    type: DataTypes.STRING
  },
  impactLevel: {
    type: DataTypes.ENUM('low', 'medium', 'high', 'critical'),
    defaultValue: 'medium'
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
});

module.exports = AffectedOrder;
