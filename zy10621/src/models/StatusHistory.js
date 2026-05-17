const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const StatusHistory = sequelize.define('StatusHistory', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  recordId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  previousStatus: {
    type: DataTypes.STRING
  },
  newStatus: {
    type: DataTypes.STRING,
    allowNull: false
  },
  changedBy: {
    type: DataTypes.INTEGER
  },
  changeReason: {
    type: DataTypes.TEXT
  },
  metadata: {
    type: DataTypes.JSON,
    defaultValue: {}
  }
}, {
  timestamps: true
});

module.exports = StatusHistory;
