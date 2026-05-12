const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Repayment = sequelize.define('Repayment', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  repaymentNo: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  contractId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  installmentId: {
    type: DataTypes.UUID,
  },
  amount: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false,
  },
  repaymentDate: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  repaymentMethod: {
    type: DataTypes.ENUM('bank_transfer', 'alipay', 'wechat', 'cash', 'auto_deduct'),
    allowNull: false,
  },
  type: {
    type: DataTypes.ENUM('full', 'partial', 'early_settlement'),
    defaultValue: 'full',
  },
  status: {
    type: DataTypes.ENUM('pending', 'success', 'failed', 'reversed'),
    defaultValue: 'pending',
  },
  isPartial: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  sourceId: {
    type: DataTypes.STRING,
    comment: '外部来源ID，用于防重',
  },
  operator: {
    type: DataTypes.STRING,
  },
  remark: {
    type: DataTypes.TEXT,
  },
});

module.exports = Repayment;
