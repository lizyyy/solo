const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ModificationHistory = sequelize.define('ModificationHistory', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  table_name: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  record_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  field_name: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  old_value: {
    type: DataTypes.TEXT
  },
  new_value: {
    type: DataTypes.TEXT
  },
  modified_by: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  operation_type: {
    type: DataTypes.STRING(20),
    allowNull: false
  },
  reason: {
    type: DataTypes.TEXT
  }
}, {
  tableName: 'modification_history',
  timestamps: true,
  createdAt: 'modified_at',
  updatedAt: false
});

module.exports = ModificationHistory;
