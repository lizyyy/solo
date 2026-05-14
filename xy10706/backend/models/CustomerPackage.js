const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const CustomerPackage = sequelize.define('CustomerPackage', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  CustomerId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  PackageId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  startDate: {
    type: DataTypes.DATE,
    allowNull: false
  },
  endDate: {
    type: DataTypes.DATE
  },
  usedQuota: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  overQuota: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  status: {
    type: DataTypes.ENUM('active', 'expired', 'cancelled'),
    defaultValue: 'active'
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

module.exports = CustomerPackage;
