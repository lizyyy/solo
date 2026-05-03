const { Model, DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Bill = require('./Bill');
const SplitRule = require('./SplitRule');
const PaymentRecord = require('./PaymentRecord');
const ChoreTask = require('./ChoreTask');
const Flatmate = require('./Flatmate');

class Dispute extends Model {}

Dispute.init({
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  dispute_type: {
    type: DataTypes.ENUM('bill', 'payment', 'chore', 'point'),
    allowNull: false,
    comment: '争议类型：bill-账单，payment-付款，chore-家务，point-积分',
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
  split_rule_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: SplitRule,
      key: 'id',
    },
    comment: '关联的分摊规则ID',
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
  raised_by_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: Flatmate,
      key: 'id',
    },
    comment: '争议发起人ID',
  },
  title: {
    type: DataTypes.STRING(200),
    allowNull: false,
    comment: '争议标题',
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: false,
    comment: '争议详情描述',
  },
  status: {
    type: DataTypes.ENUM('open', 'under_review', 'resolved', 'closed', 'rejected'),
    defaultValue: 'open',
    comment: '状态：open-新提交，under_review-审核中，resolved-已解决，closed-已关闭，rejected-已驳回',
  },
  priority: {
    type: DataTypes.ENUM('low', 'medium', 'high'),
    defaultValue: 'medium',
    comment: '优先级',
  },
  assigned_to_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: Flatmate,
      key: 'id',
    },
    comment: '分配处理的管理员ID',
  },
  proposed_solution: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '建议的解决方案',
  },
  resolution: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '最终解决方案',
  },
  resolved_by_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: Flatmate,
      key: 'id',
    },
    comment: '解决人ID',
  },
  resolved_at: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: '解决时间',
  },
  requires_balance_recalculation: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: '是否需要重新计算余额',
  },
  balance_adjusted: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: '余额是否已调整',
  },
  evidence_image_urls: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '证据图片URL列表（JSON数组）',
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '备注',
  },
}, {
  sequelize,
  modelName: 'Dispute',
  tableName: 'disputes',
  comment: '争议单表',
});

module.exports = Dispute;
