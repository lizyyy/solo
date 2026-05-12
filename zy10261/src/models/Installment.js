const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Installment = sequelize.define('Installment', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  contractId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  installmentNo: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '第几期',
  },
  originalDueDate: {
    type: DataTypes.DATE,
    allowNull: false,
    comment: '原应还日期',
  },
  currentDueDate: {
    type: DataTypes.DATE,
    allowNull: false,
    comment: '当前应还日期',
  },
  principalAmount: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false,
  },
  interestAmount: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false,
  },
  totalAmount: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false,
  },
  paidAmount: {
    type: DataTypes.DECIMAL(15, 2),
    defaultValue: 0,
  },
  remainingAmount: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false,
  },
  status: {
    type: DataTypes.ENUM('pending', 'partial', 'paid', 'overdue', 'forborne'),
    defaultValue: 'pending',
  },
  isForborne: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: '是否已宽限',
  },
  forbearanceCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: '宽限次数',
  },
  daysOverdue: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  paidDate: {
    type: DataTypes.DATE,
    comment: '实际还款日期',
  },
  remark: {
    type: DataTypes.TEXT,
  },
});

module.exports = Installment;
