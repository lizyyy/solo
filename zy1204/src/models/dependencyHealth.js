const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const DependencyHealth = sequelize.define('DependencyHealth', {
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
  dependencyName: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: '依赖服务名称'
  },
  timestamp: {
    type: DataTypes.DATE,
    allowNull: false,
    comment: '时间戳'
  },
  status: {
    type: DataTypes.ENUM('healthy', 'degraded', 'unhealthy', 'unknown'),
    defaultValue: 'unknown',
    comment: '健康状态：健康、降级、不健康、未知'
  },
  errorRate: {
    type: DataTypes.FLOAT,
    defaultValue: 0,
    comment: '错误率 (0-1)'
  },
  averageLatency: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: '平均延迟（毫秒）'
  },
  p99Latency: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'P99延迟（毫秒）'
  },
  requestCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: '请求数'
  },
  successCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: '成功数'
  },
  failureCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: '失败数'
  },
  details: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: '详细信息'
  }
}, {
  tableName: 'dependency_health',
  comment: '依赖健康度表',
  indexes: [
    {
      fields: ['experiment_id', 'dependency_name', 'timestamp']
    }
  ]
});

module.exports = DependencyHealth;
