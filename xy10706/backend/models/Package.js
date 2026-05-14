const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Package = sequelize.define('Package', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT
  },
  monthlyQuota: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  burstThreshold: {
    type: DataTypes.INTEGER,
    defaultValue: 100
  },
  burstWindowMinutes: {
    type: DataTypes.INTEGER,
    defaultValue: 5
  },
  maxRetries: {
    type: DataTypes.INTEGER,
    defaultValue: 3
  },
  pricePerCall: {
    type: DataTypes.DECIMAL(10, 4),
    defaultValue: 0.01
  },
  status: {
    type: DataTypes.ENUM('active', 'deprecated'),
    defaultValue: 'active'
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  updatedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
});

module.exports = Package;
