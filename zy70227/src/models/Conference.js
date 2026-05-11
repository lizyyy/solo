const { DataTypes } = require('sequelize');
const sequelize = require('../database');
const { ConferenceStatus } = require('../enums');

const Conference = sequelize.define('Conference', {
  id: {
    type: DataTypes.STRING,
    primaryKey: true,
    allowNull: false
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  organizer: {
    type: DataTypes.STRING,
    allowNull: true
  },
  roomId: {
    type: DataTypes.STRING,
    allowNull: true
  },
  startTime: {
    type: DataTypes.DATE,
    allowNull: false
  },
  endTime: {
    type: DataTypes.DATE,
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM(
      ConferenceStatus.PLANNED,
      ConferenceStatus.IN_PROGRESS,
      ConferenceStatus.COMPLETED,
      ConferenceStatus.CANCELLED
    ),
    allowNull: false,
    defaultValue: ConferenceStatus.PLANNED
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  tableName: 'conferences',
  timestamps: true
});

module.exports = Conference;
