const { Model, DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Bill = require('./Bill');
const Flatmate = require('./Flatmate');

class SplitRule extends Model {}

SplitRule.init({
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
  flatmate_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: Flatmate,
      key: 'id',
    },
    comment: '室友ID',
  },
  split_type: {
    type: DataTypes.ENUM('equal', 'ratio', 'specific', 'advance'),
    allowNull: false,
    comment: '分摊方式',
  },
  ratio: {
    type: DataTypes.DECIMAL(5, 4),
    allowNull: true,
    comment: '分摊比例（0-1之间）',
  },
  amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    comment: '应分摊金额',
  },
  paid_amount: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
    comment: '已支付金额',
  },
  points_used: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
    comment: '积分抵扣金额',
  },
  status: {
    type: DataTypes.ENUM('pending', 'partial', 'paid', 'overdue', 'disputed'),
    defaultValue: 'pending',
    comment: '状态：pending-待支付，partial-部分支付，paid-已支付，overdue-逾期，disputed-有争议',
  },
  due_date: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: '截止日期',
  },
  paid_date: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: '支付日期',
  },
  is_advanced_by: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: '是否为垫付人（仅当split_type为advance时）',
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '备注',
  },
}, {
  sequelize,
  modelName: 'SplitRule',
  tableName: 'split_rules',
  comment: '分摊规则表',
});

module.exports = SplitRule;
