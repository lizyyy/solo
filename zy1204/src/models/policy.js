const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Policy = sequelize.define('Policy', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: '策略名称'
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '策略描述'
  },
  type: {
    type: DataTypes.ENUM('rate_limit', 'circuit_breaker', 'fallback', 'overload_protection'),
    allowNull: false,
    comment: '策略类型：限流、熔断、降级、过载保护'
  },
  rateLimitType: {
    type: DataTypes.ENUM('token_bucket', 'leaky_bucket', 'sliding_window'),
    allowNull: true,
    comment: '限流类型：令牌桶、漏桶、滑动窗口（仅当type为rate_limit时有效）'
  },
  config: {
    type: DataTypes.JSON,
    allowNull: false,
    comment: '策略配置详情'
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    comment: '是否启用'
  },
  metadata: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: '元数据'
  }
}, {
  tableName: 'policies',
  comment: '策略配置表'
});

module.exports = Policy;
