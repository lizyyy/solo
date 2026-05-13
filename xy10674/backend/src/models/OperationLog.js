const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const OperationLog = sequelize.define('OperationLog', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  operation: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  module: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  record_id: {
    type: DataTypes.INTEGER
  },
  detail: {
    type: DataTypes.TEXT
  },
  ip_address: {
    type: DataTypes.STRING(50)
  },
  user_agent: {
    type: DataTypes.STRING(255)
  }
}, {
  tableName: 'operation_logs',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false
});

module.exports = OperationLog;
