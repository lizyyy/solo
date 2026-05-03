const { Model, DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Bill = require('./Bill');
const SplitRule = require('./SplitRule');
const Flatmate = require('./Flatmate');

class PaymentRecord extends Model {}

PaymentRecord.init({
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  bill_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: Bill,
      key: 'id',
    },
    comment: '账单ID',
  },
  split_rule_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: SplitRule,
      key: 'id',
    },
    comment: '分摊规则ID',
  },
  payer_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: Flatmate,
      key: 'id',
    },
    comment: '付款人ID',
  },
  receiver_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: Flatmate,
      key: 'id',
    },
    comment: '收款人ID（转账时使用）',
  },
  amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    comment: '付款金额',
  },
  points_used: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
    comment: '使用的积分金额',
  },
  status: {
    type: DataTypes.ENUM('pending', 'confirmed', 'rejected', 'disputed'),
    defaultValue: 'pending',
    comment: '状态：pending-待确认，confirmed-已确认，rejected-已拒绝，disputed-有争议',
  },
  payment_method: {
    type: DataTypes.ENUM('cash', 'wechat', 'alipay', 'transfer', 'points', 'other'),
    defaultValue: 'other',
    comment: '付款方式',
  },
  transaction_id: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: '交易流水号',
  },
  confirmed_by_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: Flatmate,
      key: 'id',
    },
    comment: '确认人ID',
  },
  confirmed_at: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: '确认时间',
  },
  rejected_at: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: '拒绝时间',
  },
  rejection_reason: {
    type: DataTypes.STRING(500),
    allowNull: true,
    comment: '拒绝原因',
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '备注',
  },
}, {
  sequelize,
  modelName: 'PaymentRecord',
  tableName: 'payment_records',
  comment: '付款记录表',
});

module.exports = PaymentRecord;
