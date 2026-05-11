const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Valve = sequelize.define('Valve', {
  id: {
    type: DataTypes.STRING(20),
    primaryKey: true,
    allowNull: false
  },
  name: {
    type: DataTypes.STRING(100),
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
    type: DataTypes.ENUM('main', 'branch', 'distribution'),
    allowNull: false,
    defaultValue: 'branch'
  },
  status: {
    type: DataTypes.ENUM('open', 'closed', 'maintenance', 'fault'),
    allowNull: false,
    defaultValue: 'open'
  },
  diameter: {
    type: DataTypes.INTEGER,
    comment: '管道直径(mm)'
  },
  networkNodeId: {
    type: DataTypes.STRING(20),
    allowNull: false
  }
}, {
  timestamps: true,
  tableName: 'valves'
});

module.exports = Valve;