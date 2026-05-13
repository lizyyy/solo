const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const SupplierHandover = sequelize.define('SupplierHandover', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  handover_no: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true
  },
  supplier_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  pallet_code_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  handover_date: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  handover_quantity: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  handover_status: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'pending'
  },
  deposit_amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  verified_by: {
    type: DataTypes.INTEGER
  },
  verified_at: {
    type: DataTypes.DATE
  },
  remark: {
    type: DataTypes.TEXT
  },
  created_by: {
    type: DataTypes.INTEGER,
    allowNull: false
  }
}, {
  tableName: 'supplier_handovers',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

module.exports = SupplierHandover;
