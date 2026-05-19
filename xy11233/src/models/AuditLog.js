const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const AUDIT_ACTIONS = {
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
  SUBMIT: 'submit',
  APPROVE: 'approve',
  REJECT: 'reject',
  OUTBOUND: 'outbound',
  RETURN: 'return',
  CHECK_INVENTORY: 'check_inventory',
  IMPORT: 'import',
  EXPORT: 'export',
  LOGIN: 'login',
  LOGOUT: 'logout'
};

const AuditLog = sequelize.define('AuditLog', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  action: {
    type: DataTypes.ENUM(Object.values(AUDIT_ACTIONS)),
    allowNull: false,
    comment: '操作类型'
  },
  module: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: '模块名'
  },
  record_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: '记录ID'
  },
  record_no: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: '业务编号'
  },
  operator_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '操作人ID'
  },
  operator_name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: '操作人姓名'
  },
  operator_role: {
    type: DataTypes.STRING(50),
    allowNull: false,
    comment: '操作人角色'
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
  change_fields: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '变更字段列表（JSON）'
  },
  ip_address: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: 'IP地址'
  },
  user_agent: {
    type: DataTypes.STRING(500),
    allowNull: true,
    comment: '用户代理'
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '操作描述'
  },
  success: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    comment: '是否成功'
  },
  error_message: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '错误信息'
  }
}, {
  tableName: 'audit_logs',
  comment: '审计日志表'
});

AuditLog.AUDIT_ACTIONS = AUDIT_ACTIONS;

module.exports = AuditLog;
