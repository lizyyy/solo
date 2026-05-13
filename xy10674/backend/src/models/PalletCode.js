const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const PalletCode = sequelize.define('PalletCode', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  pallet_code: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true
  },
  status: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'active'
  },
  type: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  batch_no: {
    type: DataTypes.STRING(50)
  },
  deposit_amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0.00
  },
  created_by: {
    type: DataTypes.INTEGER,
    allowNull: false
  }
}, {
  tableName: 'pallet_codes',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

module.exports = PalletCode;
