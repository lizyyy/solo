const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const CompensationTask = sequelize.define('compensation_task', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  task_type: {
    type: DataTypes.STRING(50),
    allowNull: false,
    comment: '补偿任务类型：assign-分配补偿，void-作废补偿，reprint-补打补偿'
  },
  business_key: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: '业务唯一标识'
  },
  receipt_number: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: '涉及的收据号'
  },
  window_id: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: '窗口ID'
  },
  original_request: {
    type: DataTypes.TEXT,
    allowNull: false,
    comment: '原始请求数据（JSON）'
  },
  failed_reason: {
    type: DataTypes.TEXT,
    allowNull: false,
    comment: '失败原因'
  },
  status: {
    type: DataTypes.ENUM('pending', 'processing', 'completed', 'failed', 'cancelled'),
    defaultValue: 'pending',
    comment: '状态：pending-待处理，processing-处理中，completed-已完成，failed-失败，cancelled-已取消'
  },
  retry_count: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: '重试次数'
  },
  max_retry: {
    type: DataTypes.INTEGER,
    defaultValue: 5,
    comment: '最大重试次数'
  },
  last_retry_at: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: '上次重试时间'
  },
  next_retry_at: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: '下次重试时间'
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    comment: '创建时间'
  },
  completed_at: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: '完成时间'
  },
  result_message: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '处理结果信息'
  },
  recovery_actions: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '已执行的补偿动作（JSON数组）'
  }
}, {
  tableName: 'compensation_task',
  comment: '补偿任务',
  indexes: [
    {
      name: 'idx_comp_business_key',
      unique: true,
      fields: ['business_key']
    },
    {
      name: 'idx_comp_status',
      fields: ['status']
    },
    {
      name: 'idx_comp_next_retry_at',
      fields: ['next_retry_at']
    },
    {
      name: 'idx_comp_task_type',
      fields: ['task_type']
    }
  ]
});

module.exports = CompensationTask;
