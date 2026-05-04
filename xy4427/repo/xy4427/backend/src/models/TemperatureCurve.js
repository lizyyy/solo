const { DataTypes } = require('sequelize');
const sequelize = require('../database');

const TemperatureCurve = sequelize.define('TemperatureCurve', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  jobId: {
    type: DataTypes.STRING,
    allowNull: false,
    field: 'job_id',
  },
  pageNumber: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'page_number',
  },
  timestamp: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  temperature: {
    type: DataTypes.FLOAT,
    allowNull: false,
  },
  targetTemperature: {
    type: DataTypes.FLOAT,
    allowNull: false,
    field: 'target_temperature',
  },
  machineId: {
    type: DataTypes.STRING,
    allowNull: true,
    field: 'machine_id',
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    field: 'created_at',
  },
  updatedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    field: 'updated_at',
  },
}, {
  tableName: 'temperature_curves',
  timestamps: true,
});

module.exports = TemperatureCurve;
