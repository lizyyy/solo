const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Task = sequelize.define('Task', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  payload: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM('pending', 'processing', 'completed', 'failed', 'max_retry_reached'),
    defaultValue: 'pending',
    allowNull: false
  },
  priority: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    allowNull: false
  },
  retryCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    allowNull: false
  },
  maxRetry: {
    type: DataTypes.INTEGER,
    defaultValue: 5,
    allowNull: false
  },
  retryDelay: {
    type: DataTypes.INTEGER,
    defaultValue: 3000,
    allowNull: false
  },
  lastError: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  runAt: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: 'tasks',
  timestamps: true
});

module.exports = Task;