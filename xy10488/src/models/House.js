const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const House = sequelize.define('House', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  address: {
    type: DataTypes.STRING,
    allowNull: false
  },
  waterPrice: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 5.0
  },
  electricityPrice: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0.8
  },
  publicWaterShare: {
    type: DataTypes.ENUM('by_room', 'by_person'),
    defaultValue: 'by_person'
  },
  publicElectricityShare: {
    type: DataTypes.ENUM('by_room', 'by_person'),
    defaultValue: 'by_person'
  }
});

module.exports = House;
