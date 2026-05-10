const { DataTypes } = require('sequelize');
const { sequelize } = require('../db');

const Task = sequelize.define('Task', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  type: {
    type: DataTypes.ENUM(
      'process_access_log',
      'process_conversion',
      'generate_report',
      'update_blacklist',
      'cleanup_old_data'
    ),
    allowNull: false,
    index: true,
  },
  referenceId: {
    type: DataTypes.UUID,
    allowNull: true,
    index: true,
  },
  payload: {
    type: DataTypes.JSONB,
    allowNull: true,
  },
  status: {
    type: DataTypes.ENUM(
      'pending',
      'queued',
      'processing',
      'completed',
      'failed',
      'cancelled'
    ),
    defaultValue: 'pending',
    index: true,
  },
  priority: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  attemptCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  maxAttempts: {
    type: DataTypes.INTEGER,
    defaultValue: 3,
  },
  lastAttemptAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  nextAttemptAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    index: true,
  },
  errorMessage: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  errorStack: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  result: {
    type: DataTypes.JSONB,
    allowNull: true,
  },
  startedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  completedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  parentTaskId: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  updatedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
}, {
  tableName: 'tasks',
  timestamps: true,
  indexes: [
    { fields: ['type'] },
    { fields: ['status'] },
    { fields: ['referenceId'] },
    { fields: ['nextAttemptAt'] },
    { fields: ['priority'] },
  ],
});

Task.createFailed = async function(type, error, payload = {}) {
  return this.create({
    type,
    payload,
    status: 'failed',
    errorMessage: error.message,
    errorStack: error.stack,
  });
};

Task.findFailedToRetry = async function(limit = 100) {
  return this.findAll({
    where: {
      status: 'failed',
      attemptCount: { [sequelize.Op.lt]: sequelize.col('maxAttempts') },
      nextAttemptAt: { [sequelize.Op.lte]: new Date() },
    },
    order: [['nextAttemptAt', 'ASC'], ['priority', 'DESC']],
    limit,
  });
};

module.exports = Task;
