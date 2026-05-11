const { DataTypes } = require('sequelize');
const sequelize = require('../database');
const { ScheduleStatus } = require('../enums');

const Schedule = sequelize.define('Schedule', {
  id: {
    type: DataTypes.STRING,
    primaryKey: true,
    allowNull: false
  },
  conferenceId: {
    type: DataTypes.STRING,
    allowNull: false
  },
  channelId: {
    type: DataTypes.STRING,
    allowNull: false
  },
  interpreterId: {
    type: DataTypes.STRING,
    allowNull: false
  },
  deviceId: {
    type: DataTypes.STRING,
    allowNull: false
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
      ScheduleStatus.DRAFT,
      ScheduleStatus.CONFIRMED,
      ScheduleStatus.IN_USE,
      ScheduleStatus.COMPLETED,
      ScheduleStatus.CANCELLED
    ),
    allowNull: false,
    defaultValue: ScheduleStatus.DRAFT
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  tableName: 'schedules',
  timestamps: true
});

module.exports = Schedule;
