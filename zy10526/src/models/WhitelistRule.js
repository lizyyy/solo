const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const WhitelistRule = sequelize.define('WhitelistRule', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  ruleCode: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    comment: '规则编码'
  },
  ruleName: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: '规则名称'
  },
  whitelistTypeId: {
    type: DataTypes.UUID,
    allowNull: false,
    comment: '关联白名单类型ID'
  },
  matchConditions: {
    type: DataTypes.JSON,
    allowNull: false,
    comment: '匹配条件，JSON格式存储各种匹配规则'
  },
  effectScope: {
    type: DataTypes.ENUM('all', 'specific', 'region', 'channel'),
    defaultValue: 'all',
    comment: '生效范围'
  },
  effectiveDate: {
    type: DataTypes.DATE,
    allowNull: false,
    comment: '生效日期'
  },
  expiryDate: {
    type: DataTypes.DATE,
    comment: '到期日期，null表示永不过期'
  },
  status: {
    type: DataTypes.ENUM('draft', 'active', 'expired', 'disabled'),
    defaultValue: 'draft',
    comment: '规则状态'
  },
  createdBy: {
    type: DataTypes.STRING,
    comment: '创建人'
  }
}, {
  tableName: 'whitelist_rules',
  timestamps: true
});

module.exports = WhitelistRule;
