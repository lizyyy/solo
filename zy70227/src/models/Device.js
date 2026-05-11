const { DataTypes } = require('sequelize');
const sequelize = require('../database');

const Device = sequelize.define('Device', {
  id: {
    type: DataTypes.STRING,
    primaryKey: true,
    allowNull: false
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  type: {
    type: DataTypes.ENUM('transmitter', 'receiver', 'console', 'headset'),
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM('available', 'in_use', 'maintenance'),
    allowNull: false,
    defaultValue: 'available'
  },
  roomId: {
    type: DataTypes.STRING,
    allowNull: false
  }
}, {
  tableName: 'devices',
  timestamps: true
});

module.exports = Device;
