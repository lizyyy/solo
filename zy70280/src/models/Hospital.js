const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Hospital = sequelize.define('Hospital', {
  id: {
    type: DataTypes.STRING(20),
    primaryKey: true,
    allowNull: false
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  address: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  level: {
    type: DataTypes.ENUM('primary', 'secondary', 'tertiary'),
    allowNull: false,
    comment: '医院等级'
  },
  beds: {
    type: DataTypes.INTEGER,
    comment: '床位数'
  },
  hasIcu: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: '是否有ICU'
  },
  networkNodeId: {
    type: DataTypes.STRING(20),
    allowNull: false,
    comment: '供水节点ID'
  },
  backupWater: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: '是否有备用水源'
  },
  contactPerson: {
    type: DataTypes.STRING(50),
    comment: '联系人'
  },
  contactPhone: {
    type: DataTypes.STRING(20),
    comment: '联系电话'
  }
}, {
  timestamps: true,
  tableName: 'hospitals'
});

module.exports = Hospital;