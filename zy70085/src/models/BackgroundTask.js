const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const BackgroundTask = sequelize.define('BackgroundTask', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4
  },
  taskType: {
    type: DataTypes.STRING,
    allowNull: false
  },
  targetType: {
    type: DataTypes.STRING,
    allowNull: false
  },
  targetId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  status: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'PENDING'
  },
  payload: {
    type: DataTypes.JSON,
    defaultValue: {}
  },
  result: {
    type: DataTypes.JSON,
    defaultValue: null
  },
  errorMessage: {
    type: DataTypes.TEXT
  },
  errorStack: {
    type: DataTypes.TEXT
  },
  retryCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  maxRetries: {
    type: DataTypes.INTEGER,
    defaultValue: 5
  },
  nextRetryAt: {
    type: DataTypes.DATE
  },
  startedAt: {
    type: DataTypes.DATE
  },
  completedAt: {
    type: DataTypes.DATE
  },
  failedAt: {
    type: DataTypes.DATE
  },
  priority: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  version: {
    type: DataTypes.INTEGER,
    defaultValue: 1,
    allowNull: false
  },
  metadata: {
    type: DataTypes.JSON,
    defaultValue: {}
  }
}, {
  tableName: 'background_tasks',
  timestamps: true,
  indexes: [
    {
      fields: ['taskType']
    },
    {
      fields: ['status']
    },
    {
      fields: ['targetType', 'targetId']
    },
    {
      fields: ['status', 'nextRetryAt']
    }
  ]
});

module.exports = BackgroundTask;
