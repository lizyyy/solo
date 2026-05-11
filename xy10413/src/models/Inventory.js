const { DataTypes } = require('sequelize');
const sequelize = require('../db/database');

const Inventory = sequelize.define('Inventory', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  productCode: {
    type: DataTypes.STRING,
    allowNull: false,
    field: 'product_code'
  },
  productName: {
    type: DataTypes.STRING,
    allowNull: false,
    field: 'product_name'
  },
  spec: {
    type: DataTypes.STRING,
    allowNull: false
  },
  quantity: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0
  },
  location: {
    type: DataTypes.STRING
  },
  batchNo: {
    type: DataTypes.STRING,
    field: 'batch_no'
  }
}, {
  tableName: 'inventories'
});

module.exports = Inventory;
