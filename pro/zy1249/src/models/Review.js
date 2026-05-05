const { DataTypes } = require('sequelize')
const sequelize = require('../config/database')

const Review = sequelize.define('Review', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4
  },
  apiName: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'API 名称'
  },
  apiVersion: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'API 版本'
  },
  openapiSpecId: {
    type: DataTypes.UUID,
    allowNull: false,
    comment: '关联的 OpenAPI 规范 ID'
  },
  rulesConfigId: {
    type: DataTypes.UUID,
    allowNull: true,
    comment: '关联的规则配置 ID'
  },
  status: {
    type: DataTypes.ENUM('pending', 'running', 'completed', 'failed'),
    defaultValue: 'pending',
    comment: '评审状态'
  },
  score: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: true,
    comment: '合规性得分 (0-100)'
  },
  totalIssues: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: '问题总数'
  },
  criticalIssues: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: '严重问题数'
  },
  errorIssues: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: '错误问题数'
  },
  warningIssues: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: '警告问题数'
  },
  infoIssues: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: '信息问题数'
  },
  startedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: '开始时间'
  },
  completedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: '完成时间'
  },
  duration: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: '执行时长（毫秒）'
  },
  errorMessage: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '错误信息'
  },
  metadata: {
    type: DataTypes.JSON,
    defaultValue: {},
    comment: '元数据'
  }
}, {
  tableName: 'reviews',
  indexes: [
    { fields: ['api_name'] },
    { fields: ['status'] },
    { fields: ['created_at'] }
  ]
})

module.exports = Review