const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const BackgroundJob = sequelize.define('BackgroundJob', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4
  },
  jobType: {
    type: DataTypes.ENUM('calculate_result', 'recalculate_shortage', 'generate_report'),
    allowNull: false
  },
  shortageId: {
    type: DataTypes.UUID
  },
  payload: {
    type: DataTypes.TEXT
  },
  status: {
    type: DataTypes.ENUM('pending', 'running', 'completed', 'failed', 'cancelled'),
    defaultValue: 'pending'
  },
  retryCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  maxRetries: {
    type: DataTypes.INTEGER,
    defaultValue: 3
  },
  errorMessage: {
    type: DataTypes.TEXT
  },
  executedAt: {
    type: DataTypes.DATE
  },
  completedAt: {
    type: DataTypes.DATE
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
});

module.exports = BackgroundJob;
