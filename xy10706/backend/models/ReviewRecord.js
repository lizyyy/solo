const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ReviewRecord = sequelize.define('ReviewRecord', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  CallRecordId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  CustomerId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  reviewer: {
    type: DataTypes.STRING,
    allowNull: false
  },
  action: {
    type: DataTypes.ENUM('approve', 'reject', 'correct'),
    allowNull: false
  },
  reason: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  previousStatus: {
    type: DataTypes.STRING,
    allowNull: false
  },
  newStatus: {
    type: DataTypes.STRING,
    allowNull: false
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

module.exports = ReviewRecord;
