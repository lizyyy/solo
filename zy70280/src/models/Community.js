const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Community = sequelize.define('Community', {
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
  households: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '住户数'
  },
  population: {
    type: DataTypes.INTEGER,
    comment: '人口数'
  },
  networkNodeId: {
    type: DataTypes.STRING(20),
    allowNull: false,
    comment: '供水节点ID'
  },
  waterPressure: {
    type: DataTypes.FLOAT,
    comment: '水压(MPa)'
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
  tableName: 'communities'
});

module.exports = Community;