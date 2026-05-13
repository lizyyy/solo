const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const DepositFlow = sequelize.define('DepositFlow', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  flow_no: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true
  },
  flow_type: {
    type: DataTypes.STRING(20),
    allowNull: false
  },
  related_type: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  related_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  flow_status: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'pending'
  },
  blocked_reason: {
    type: DataTypes.TEXT
  },
  processed_by: {
    type: DataTypes.INTEGER
  },
  processed_at: {
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
  tableName: 'deposit_flows',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

module.exports = DepositFlow;
