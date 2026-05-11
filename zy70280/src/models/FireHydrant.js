const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const FireHydrant = sequelize.define('FireHydrant', {
  id: {
    type: DataTypes.STRING(20),
    primaryKey: true,
    allowNull: false
  },
  location: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  longitude: {
    type: DataTypes.FLOAT,
    allowNull: false
  },
  latitude: {
    type: DataTypes.FLOAT,
    allowNull: false
  },
  type: {
    type: DataTypes.ENUM('ground', 'underground'),
    allowNull: false,
    defaultValue: 'ground'
  },
  status: {
    type: DataTypes.ENUM('active', 'maintenance', 'fault'),
    allowNull: false,
    defaultValue: 'active'
  },
  networkNodeId: {
    type: DataTypes.STRING(20),
    allowNull: false,
    comment: '供水节点ID'
  },
  lastInspectionDate: {
    type: DataTypes.DATE,
    comment: '上次检查日期'
  }
}, {
  timestamps: true,
  tableName: 'fire_hydrants'
});

module.exports = FireHydrant;