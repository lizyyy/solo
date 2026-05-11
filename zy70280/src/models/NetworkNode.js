const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const NetworkNode = sequelize.define('NetworkNode', {
  id: {
    type: DataTypes.STRING(20),
    primaryKey: true,
    allowNull: false
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  nodeType: {
    type: DataTypes.ENUM('source', 'junction', 'endpoint', 'tank', 'pump'),
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
  elevation: {
    type: DataTypes.FLOAT,
    comment: '海拔高度(m)'
  },
  zoneId: {
    type: DataTypes.STRING(20),
    comment: '供水区域ID'
  }
}, {
  timestamps: true,
  tableName: 'network_nodes'
});

module.exports = NetworkNode;