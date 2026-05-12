const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Contract = sequelize.define('Contract', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  contractNo: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  customerName: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  customerIdNo: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  principal: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false,
  },
  interestRate: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: false,
    comment: '年利率 %',
  },
  totalAmount: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false,
  },
  term: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '分期期数',
  },
  startDate: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  status: {
    type: DataTypes.ENUM('active', 'paid_off', 'defaulted', 'settled'),
    defaultValue: 'active',
  },
  maxForbearanceTimes: {
    type: DataTypes.INTEGER,
    defaultValue: 3,
    comment: '最大宽限次数',
  },
  usedForbearanceTimes: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: '已使用宽限次数',
  },
  isInCollection: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: '是否在催收中',
  },
  collectionFreezeUntil: {
    type: DataTypes.DATE,
    comment: '催收冻结截止日期',
  },
  remark: {
    type: DataTypes.TEXT,
  },
});

module.exports = Contract;
