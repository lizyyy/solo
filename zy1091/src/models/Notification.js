const { Model, DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Flatmate = require('./Flatmate');
const Bill = require('./Bill');
const PaymentRecord = require('./PaymentRecord');
const ChoreTask = require('./ChoreTask');
const Dispute = require('./Dispute');

class Notification extends Model {}

Notification.init({
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  recipient_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: Flatmate,
      key: 'id',
    },
    comment: '接收人ID',
  },
  notification_type: {
    type: DataTypes.ENUM(
      'bill_created',
      'bill_due_soon',
      'bill_overdue',
      'bill_payment_received',
      'bill_payment_confirmed',
      'bill_dispute_opened',
      'bill_dispute_resolved',
      'chore_assigned',
      'chore_due_soon',
      'chore_overdue',
      'chore_completed',
      'chore_dispute_opened',
      'point_earned',
      'point_deducted',
      'point_used',
      'dispute_assigned',
      'dispute_updated',
      'system_alert',
      'other'
    ),
    allowNull: false,
    comment: '通知类型',
  },
  title: {
    type: DataTypes.STRING(200),
    allowNull: false,
    comment: '通知标题',
  },
  content: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '通知内容',
  },
  is_read: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: '是否已读',
  },
  read_at: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: '阅读时间',
  },
  is_urgent: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: '是否紧急',
  },
  bill_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: Bill,
      key: 'id',
    },
    comment: '关联的账单ID',
  },
  payment_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: PaymentRecord,
      key: 'id',
    },
    comment: '关联的付款记录ID',
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
  dispute_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: Dispute,
      key: 'id',
    },
    comment: '关联的争议单ID',
  },
  action_url: {
    type: DataTypes.STRING(500),
    allowNull: true,
    comment: '操作跳转URL',
  },
  is_system_generated: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    comment: '是否为系统自动生成',
  },
  created_by_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: Flatmate,
      key: 'id',
    },
    comment: '创建人ID（手动创建时）',
  },
  expires_at: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: '过期时间',
  },
}, {
  sequelize,
  modelName: 'Notification',
  tableName: 'notifications',
  comment: '通知记录表',
});

module.exports = Notification;
