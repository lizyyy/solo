const { Model, DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Flatmate = require('./Flatmate');
const ChoreTask = require('./ChoreTask');
const Bill = require('./Bill');

class PointAdjustment extends Model {}

PointAdjustment.init({
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
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
  task_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: ChoreTask,
      key: 'id',
    },
    comment: '关联的家务任务ID',
  },
  bill_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: Bill,
      key: 'id',
    },
    comment: '关联的账单ID（用于积分抵扣）',
  },
  adjustment_type: {
    type: DataTypes.ENUM('reward', 'penalty', 'deduction', 'manual_add', 'manual_subtract'),
    allowNull: false,
    comment: '调整类型：reward-任务奖励，penalty-任务惩罚，deduction-积分抵扣账单，manual_add-手动增加，manual_subtract-手动减少',
  },
  points: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '调整的积分数值（正数为增加，负数为减少）',
  },
  balance_before: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '调整前积分余额',
  },
  balance_after: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '调整后积分余额',
  },
  monetary_value: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    comment: '积分对应的货币价值（1积分=?元）',
  },
  reason: {
    type: DataTypes.STRING(500),
    allowNull: false,
    comment: '调整原因',
  },
  operator_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: Flatmate,
      key: 'id',
    },
    comment: '操作人ID（系统操作则为null）',
  },
  is_system_generated: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    comment: '是否为系统自动生成',
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '备注',
  },
}, {
  sequelize,
  modelName: 'PointAdjustment',
  tableName: 'point_adjustments',
  comment: '积分调整记录表',
});

module.exports = PointAdjustment;
