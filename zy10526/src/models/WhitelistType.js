const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const WhitelistType = sequelize.define('WhitelistType', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  typeCode: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    comment: '白名单类型编码'
  },
  typeName: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: '白名单类型名称'
  },
  description: {
    type: DataTypes.TEXT,
    comment: '类型描述'
  },
  priority: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: '优先级，数字越大优先级越高'
  },
  isEnabled: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    comment: '是否启用'
  }
}, {
  tableName: 'whitelist_types',
  timestamps: true
});

module.exports = WhitelistType;
