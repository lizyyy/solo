const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const StoreCollection = sequelize.define('StoreCollection', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  collection_no: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true
  },
  store_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  pallet_code_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  collection_date: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  collection_quantity: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  damaged_quantity: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  collection_status: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'pending'
  },
  refund_amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0.00
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
  tableName: 'store_collections',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

module.exports = StoreCollection;
