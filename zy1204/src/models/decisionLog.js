const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const DecisionLog = sequelize.define('DecisionLog', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  experimentId: {
    type: DataTypes.UUID,
    allowNull: false,
    comment: '实验ID'
  },
  requestId: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: '请求ID'
  },
  timestamp: {
    type: DataTypes.DATE,
    allowNull: false,
    comment: '时间戳'
  },
  action: {
    type: DataTypes.ENUM('allow', 'queue', 'reject', 'fallback'),
    allowNull: false,
    comment: '判定结果：放行、排队、拒绝、降级'
  },
  policyType: {
    type: DataTypes.ENUM('rate_limit', 'circuit_breaker', 'fallback', 'overload_protection'),
    allowNull: true,
    comment: '触发的策略类型'
  },
  policyId: {
    type: DataTypes.UUID,
    allowNull: true,
    comment: '触发的策略ID'
  },
  reason: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: '判定原因'
  },
  requestInfo: {
    type: DataTypes.JSON,
    allowNull: false,
    comment: '请求信息（URL、方法、参数等）'
  },
  responseInfo: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: '响应信息（状态码、延迟、错误等）'
  },
  latency: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: '请求延迟（毫秒）'
  },
  queuePosition: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: '排队位置（如果action为queue）'
  },
  queueWaitTime: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: '排队等待时间（毫秒）'
  },
  fallbackDetails: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: '降级策略详情（如果action为fallback）'
  },
  metadata: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: '元数据'
  }
}, {
  tableName: 'decision_logs',
  comment: '判定日志表',
  indexes: [
    {
      fields: ['experiment_id', 'timestamp']
    },
    {
      fields: ['experiment_id', 'action']
    }
  ]
});

module.exports = DecisionLog;
