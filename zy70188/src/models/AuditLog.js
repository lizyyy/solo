const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const AuditLog = sequelize.define('audit_log', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  action: {
    type: DataTypes.STRING(50),
    allowNull: false,
    comment: '操作类型：assign-分配，void-作废，reprint-补打，recover-回收，check_gap-检测断号，export-导出，create_segment-创建号段'
  },
  action_description: {
    type: DataTypes.STRING(200),
    allowNull: false,
    comment: '操作描述（业务化语言）'
  },
  module: {
    type: DataTypes.STRING(50),
    allowNull: false,
    comment: '模块：segment_pool-号段池，assignment-分配，void-作废，reprint-补打，report-报表'
  },
  receipt_number: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: '涉及的收据号'
  },
  window_id: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: '涉及的窗口ID'
  },
  operator_id: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: '操作员ID'
  },
  operator_name: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: '操作员名称'
  },
  ip_address: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: 'IP地址'
  },
  request_id: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: '请求ID'
  },
  before_data: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '操作前数据（JSON）'
  },
  after_data: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '操作后数据（JSON）'
  },
  result: {
    type: DataTypes.ENUM('success', 'failed', 'partial'),
    defaultValue: 'success',
    comment: '操作结果'
  },
  error_message: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '错误信息'
  },
  log_time: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    comment: '日志时间'
  }
}, {
  tableName: 'audit_log',
  comment: '审计日志',
  indexes: [
    {
      name: 'idx_audit_action',
      fields: ['action']
    },
    {
      name: 'idx_audit_receipt_number',
      fields: ['receipt_number']
    },
    {
      name: 'idx_audit_operator_id',
      fields: ['operator_id']
    },
    {
      name: 'idx_audit_log_time',
      fields: ['log_time']
    },
    {
      name: 'idx_audit_window_id',
      fields: ['window_id']
    }
  ]
});

module.exports = AuditLog;
