const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Delivery = sequelize.define('Delivery', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  orderId: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    references: {
      model: 'Orders',
      key: 'id'
    }
  },
  riderId: {
    type: DataTypes.STRING,
    allowNull: true
  },
  riderName: {
    type: DataTypes.STRING,
    allowNull: true
  },
  delayReason: {
    type: DataTypes.ENUM('none', 'restaurant', 'rider', 'traffic', 'weather', 'other'),
    defaultValue: 'none'
  },
  delayMinutes: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  packageStatus: {
    type: DataTypes.ENUM('intact', 'damaged', 'missing'),
    defaultValue: 'intact'
  }
}, {
  timestamps: true
});

module.exports = Delivery;
