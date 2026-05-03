const { Model, DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Flatmate = require('./Flatmate');

class Bill extends Model {}

Bill.init({
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  title: {
    type: DataTypes.STRING(200),
    allowNull: false,
    comment: '账单标题',
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '账单描述',
  },
  category: {
    type: DataTypes.ENUM('utility', 'supplies', 'rent', 'service', 'other'),
    defaultValue: 'other',
    comment: '账单类型：utility-水电网，supplies-公共用品，rent-房租，service-服务，other-其他',
  },
  total_amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    comment: '账单总金额',
  },
  split_type: {
    type: DataTypes.ENUM('equal', 'ratio', 'specific', 'advance'),
    allowNull: false,
    comment: '分摊方式：equal-均摊，ratio-按比例，specific-指定人员，advance-垫付报销',
  },
  status: {
    type: DataTypes.ENUM('pending', 'partial', 'settled', 'overdue', 'disputed'),
    defaultValue: 'pending',
    comment: '账单状态：pending-待确认，partial-部分确认，settled-已结清，overdue-逾期，disputed-有争议',
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
  creator_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: Flatmate,
      key: 'id',
    },
    comment: '创建者ID',
  },
  advanced_by_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: Flatmate,
      key: 'id',
    },
    comment: '垫付人ID（仅当split_type为advance时）',
  },
  total_paid_amount: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
    comment: '已支付总金额',
  },
  points_deducted: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
    comment: '积分抵扣总金额',
  },
  has_dispute: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: '是否存在争议',
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '备注',
  },
}, {
  sequelize,
  modelName: 'Bill',
  tableName: 'bills',
  comment: '账单表',
});

module.exports = Bill;
