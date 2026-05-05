const { DataTypes } = require('sequelize')
const sequelize = require('../config/database')

const Issue = sequelize.define('Issue', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4
  },
  reviewId: {
    type: DataTypes.UUID,
    allowNull: false,
    comment: '关联的评审 ID'
  },
  ruleId: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: '规则 ID'
  },
  ruleName: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: '规则名称'
  },
  category: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: '问题分类'
  },
  severity: {
    type: DataTypes.ENUM('critical', 'error', 'warning', 'info'),
    allowNull: false,
    defaultValue: 'warning',
    comment: '严重级别'
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: '问题标题'
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '问题描述'
  },
  suggestion: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '修复建议'
  },
  location: {
    type: DataTypes.JSON,
    defaultValue: {},
    comment: '问题位置信息'
  },
  path: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'API 路径'
  },
  method: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'HTTP 方法'
  },
  codeExample: {
    type: DataTypes.JSON,
    defaultValue: {},
    comment: '坏样例和好样例'
  },
  reference: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '参考文档链接'
  },
  isFixed: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: '是否已修复'
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '备注'
  }
}, {
  tableName: 'issues',
  indexes: [
    { fields: ['review_id'] },
    { fields: ['severity'] },
    { fields: ['rule_id'] },
    { fields: ['category'] }
  ]
})

module.exports = Issue