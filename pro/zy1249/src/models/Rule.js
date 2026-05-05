const { DataTypes } = require('sequelize')
const sequelize = require('../config/database')

const Rule = sequelize.define('Rule', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4
  },
  ruleId: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    comment: '规则标识'
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: '规则名称'
  },
  category: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: '规则分类'
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '规则描述'
  },
  severity: {
    type: DataTypes.ENUM('critical', 'error', 'warning', 'info'),
    allowNull: false,
    defaultValue: 'warning',
    comment: '默认严重级别'
  },
  isEnabled: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    comment: '是否启用'
  },
  config: {
    type: DataTypes.JSON,
    defaultValue: {},
    comment: '规则配置参数'
  },
  examples: {
    type: DataTypes.JSON,
    defaultValue: {},
    comment: '示例代码（坏样例和好样例）'
  },
  reference: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '参考文档'
  }
}, {
  tableName: 'rules',
  indexes: [
    { fields: ['rule_id'], unique: true },
    { fields: ['category'] },
    { fields: ['is_enabled'] }
  ]
})

module.exports = Rule