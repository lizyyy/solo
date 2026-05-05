const { DataTypes } = require('sequelize')
const sequelize = require('../config/database')

const OpenApiSpec = sequelize.define('OpenApiSpec', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: '规范名称'
  },
  version: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'API 版本'
  },
  openapiVersion: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'OpenAPI 版本'
  },
  content: {
    type: DataTypes.TEXT,
    allowNull: false,
    comment: 'YAML/JSON 格式的 OpenAPI 内容'
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
  title: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'API 标题'
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'API 描述'
  },
  baseUrl: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: '基础 URL'
  },
  metadata: {
    type: DataTypes.JSON,
    defaultValue: {},
    comment: '元数据'
  }
}, {
  tableName: 'openapi_specs',
  indexes: [
    { fields: ['file_hash'], unique: true },
    { fields: ['name'] },
    { fields: ['created_at'] }
  ]
})

module.exports = OpenApiSpec