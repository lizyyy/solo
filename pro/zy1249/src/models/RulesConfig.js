const { DataTypes } = require('sequelize')
const sequelize = require('../config/database')

const RulesConfig = sequelize.define('RulesConfig', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: '规则配置名称'
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '规则配置描述'
  },
  content: {
    type: DataTypes.TEXT,
    allowNull: false,
    comment: 'YAML/JSON 格式的规则配置内容'
  },
  fileHash: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: '文件哈希值，用于去重'
  },
  originalFilename: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: '原始文件名'
  },
  ruleOverrides: {
    type: DataTypes.JSON,
    defaultValue: {},
    comment: '规则覆盖配置'
  },
  isDefault: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: '是否为默认配置'
  },
  metadata: {
    type: DataTypes.JSON,
    defaultValue: {},
    comment: '元数据'
  }
}, {
  tableName: 'rules_configs',
  indexes: [
    { fields: ['file_hash'], unique: true },
    { fields: ['is_default'] },
    { fields: ['name'] }
  ]
})

module.exports = RulesConfig