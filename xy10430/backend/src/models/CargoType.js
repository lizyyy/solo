const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const CargoType = sequelize.define('CargoType', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true
  },
  minTemp: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: false
  },
  maxTemp: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: false
  },
  maxOvertimeMinutes: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  claimMultiplier: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: false,
    defaultValue: 1.00
  },
  description: {
    type: DataTypes.TEXT
  }
}, {
  tableName: 'cargo_types',
  timestamps: true
});

module.exports = CargoType;
