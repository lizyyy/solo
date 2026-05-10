const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const MaterialShortage = sequelize.define('MaterialShortage', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4
  },
  shortageNo: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  materialCode: {
    type: DataTypes.STRING,
    allowNull: false
  },
  materialName: {
    type: DataTypes.STRING,
    allowNull: false
  },
  supplierCode: {
    type: DataTypes.STRING,
    allowNull: false
  },
  supplierName: {
    type: DataTypes.STRING,
    allowNull: false
  },
  requiredDate: {
    type: DataTypes.DATE,
    allowNull: false
  },
  requiredQuantity: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM('pending', 'processing', 'resolved', 'withdrawn'),
    defaultValue: 'pending'
  },
  latestPromiseDate: {
    type: DataTypes.DATE
  },
  actualDeliveryDate: {
    type: DataTypes.DATE
  },
  deliveryQuantity: {
    type: DataTypes.DECIMAL(15, 2)
  },
  result: {
    type: DataTypes.TEXT
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

module.exports = MaterialShortage;
