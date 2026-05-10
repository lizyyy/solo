const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const UrgeTask = sequelize.define('UrgeTask', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4
  },
  shortageId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  taskNo: {
    type: DataTypes.STRING,
    allowNull: false
  },
  priority: {
    type: DataTypes.ENUM('normal', 'high', 'urgent'),
    defaultValue: 'normal'
  },
  assignee: {
    type: DataTypes.STRING
  },
  content: {
    type: DataTypes.TEXT
  },
  status: {
    type: DataTypes.ENUM('pending', 'in_progress', 'completed', 'cancelled'),
    defaultValue: 'pending'
  },
  dueDate: {
    type: DataTypes.DATE
  },
  response: {
    type: DataTypes.TEXT
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  completedAt: {
    type: DataTypes.DATE
  }
});

module.exports = UrgeTask;
