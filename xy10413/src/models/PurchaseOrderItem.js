const { DataTypes } = require('sequelize');
const sequelize = require('../db/database');

const PurchaseOrderItem = sequelize.define('PurchaseOrderItem', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  poId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'po_id'
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
    allowNull: false
  },
  unitPrice: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    field: 'unit_price'
  },
  amount: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false
  },
  receivedQuantity: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
    field: 'received_quantity'
  }
}, {
  tableName: 'purchase_order_items'
});

module.exports = PurchaseOrderItem;
