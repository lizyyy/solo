const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Inventory = sequelize.define('Inventory', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  warehouseId: {
    type: DataTypes.UUID,
    allowNull: true
  },
  productId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  quantity: {
    type: DataTypes.DECIMAL(12, 2),
    defaultValue: 0.00
  },
  version: {
    type: DataTypes.INTEGER,
    defaultValue: 1,
    allowNull: false
  }
}, {
  timestamps: true,
  tableName: 'inventories'
});

module.exports = Inventory;