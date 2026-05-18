const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const FinanceOrder = sequelize.define('FinanceOrder', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4
  },
  financeOrderNo: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
    comment: '融资单编号'
  },
  customerId: {
    type: DataTypes.UUID,
    allowNull: false,
    comment: '客户ID'
  },
  customerName: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: '客户名称'
  },
  amount: {
    type: DataTypes.DECIMAL(18, 2),
    allowNull: false,
    comment: '融资金额'
  },
  isFrozen: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    comment: '是否冻结'
  },
  freezeReason: {
    type: DataTypes.TEXT,
    comment: '冻结原因'
  }
}, {
  tableName: 'finance_orders',
  timestamps: true
});

module.exports = FinanceOrder;