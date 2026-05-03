const { Model, DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Flatmate = require('./Flatmate');

class ChoreTask extends Model {}

ChoreTask.init({
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  title: {
    type: DataTypes.STRING(200),
    allowNull: false,
    comment: '任务标题',
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '任务描述',
  },
  category: {
    type: DataTypes.ENUM('cleaning', 'shopping', 'maintenance', 'trash', 'laundry', 'other'),
    defaultValue: 'other',
    comment: '任务类型：cleaning-清洁，shopping-采购，maintenance-维护，trash-倒垃圾，laundry-洗衣，other-其他',
  },
  assigned_to_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: Flatmate,
      key: 'id',
    },
    comment: '分配给的室友ID',
  },
  points_reward: {
    type: DataTypes.INTEGER,
    defaultValue: 10,
    comment: '完成奖励积分',
  },
  points_penalty: {
    type: DataTypes.INTEGER,
    defaultValue: 5,
    comment: '未完成惩罚积分',
  },
  status: {
    type: DataTypes.ENUM('pending', 'in_progress', 'completed', 'missed', 'skipped', 'disputed'),
    defaultValue: 'pending',
    comment: '状态：pending-待执行，in_progress-进行中，completed-已完成，missed-爽约，skipped-跳过，disputed-有争议',
  },
  priority: {
    type: DataTypes.ENUM('low', 'medium', 'high'),
    defaultValue: 'medium',
    comment: '优先级',
  },
  due_date: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: '截止日期',
  },
  completed_at: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: '完成时间',
  },
  completed_by_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: Flatmate,
      key: 'id',
    },
    comment: '实际完成人ID',
  },
  is_recurring: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: '是否为周期性任务',
  },
  recurrence_pattern: {
    type: DataTypes.ENUM('daily', 'weekly', 'biweekly', 'monthly'),
    allowNull: true,
    comment: '周期模式：daily-每天，weekly-每周，biweekly-每两周，monthly-每月',
  },
  recurrence_days: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: '周期日期（JSON数组，如["周一","周三"]）',
  },
  parent_task_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: '父任务ID（周期性任务的原始任务）',
  },
  proof_image_url: {
    type: DataTypes.STRING(500),
    allowNull: true,
    comment: '证明图片URL',
  },
  verified_by_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: Flatmate,
      key: 'id',
    },
    comment: '验证人ID',
  },
  verified_at: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: '验证时间',
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '备注',
  },
}, {
  sequelize,
  modelName: 'ChoreTask',
  tableName: 'chore_tasks',
  comment: '家务任务表',
});

module.exports = ChoreTask;
