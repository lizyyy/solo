const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ExceptionLog = sequelize.define('ExceptionLog', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  requestId: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: '请求ID，用于追踪'
  },
  exceptionType: {
    type: DataTypes.ENUM('validation_error', 'rule_mismatch', 'duplicate_call', 'expired_rule', 'permission_denied', 'system_error', 'other'),
    allowNull: false,
    comment: '异常类型'
  },
  severity: {
    type: DataTypes.ENUM('low', 'medium', 'high', 'critical'),
    defaultValue: 'medium',
    comment: '严重程度'
  },
  originalInput: {
    type: DataTypes.JSON,
    comment: '原始输入数据'
  },
  processingBasis: {
    type: DataTypes.JSON,
    comment: '处理依据'
  },
  errorMessage: {
    type: DataTypes.TEXT,
    comment: '错误信息'
  },
  stackTrace: {
    type: DataTypes.TEXT,
    comment: '堆栈信息'
  },
  customerId: {
    type: DataTypes.UUID,
    comment: '关联客户ID'
  },
  customerWhitelistId: {
    type: DataTypes.UUID,
    comment: '关联白名单ID'
  },
  operator: {
    type: DataTypes.STRING,
    comment: '操作人'
  },
  apiEndpoint: {
    type: DataTypes.STRING,
    comment: 'API端点'
  },
  httpMethod: {
    type: DataTypes.STRING,
    comment: 'HTTP方法'
  },
  resolved: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: '是否已解决'
  },
  resolvedBy: {
    type: DataTypes.STRING,
    comment: '解决人'
  },
  resolvedAt: {
    type: DataTypes.DATE,
    comment: '解决时间'
  },
  resolutionNote: {
    type: DataTypes.TEXT,
    comment: '解决说明'
  }
}, {
  tableName: 'exception_logs',
  timestamps: true
});

module.exports = ExceptionLog;
