const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Product = sequelize.define('Product', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  code: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true
  },
  name: {
    type: DataTypes.STRING(200),
    allowNull: false
  },
  barcode: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  specification: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  unit: {
    type: DataTypes.STRING(20),
    defaultValue: '个'
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
}, {
  timestamps: true,
  tableName: 'products'
});

module.exports = Product;