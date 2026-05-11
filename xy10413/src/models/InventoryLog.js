const { DataTypes } = require('sequelize');
const sequelize = require('../db/database');

const InventoryLog = sequelize.define('InventoryLog', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  inventoryId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'inventory_id'
  },
  type: {
    type: DataTypes.ENUM('in', 'out'),
    allowNull: false
  },
  quantity: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  referenceType: {
    type: DataTypes.STRING,
    field: 'reference_type'
  },
  referenceId: {
    type: DataTypes.UUID,
    field: 'reference_id'
  },
  createdBy: {
    type: DataTypes.STRING,
    allowNull: false,
    field: 'created_by'
  },
  createdAt: {
    type: DataTypes.DATE,
    field: 'created_at'
  }
}, {
  tableName: 'inventory_logs'
});

module.exports = InventoryLog;
