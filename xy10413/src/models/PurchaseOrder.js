const { DataTypes } = require('sequelize');
const sequelize = require('../db/database');

const PurchaseOrder = sequelize.define('PurchaseOrder', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  poNo: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    field: 'po_no'
  },
  supplierId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'supplier_id'
  },
  status: {
    type: DataTypes.ENUM('draft', 'published', 'partial_arrival', 'full_arrival', 'completed'),
    defaultValue: 'draft'
  },
  createdBy: {
    type: DataTypes.STRING,
    allowNull: false,
    field: 'created_by'
  },
  createdAt: {
    type: DataTypes.DATE,
    field: 'created_at'
  },
  updatedAt: {
    type: DataTypes.DATE,
    field: 'updated_at'
  }
}, {
  tableName: 'purchase_orders'
});

module.exports = PurchaseOrder;
