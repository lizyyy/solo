const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const CollectionTask = sequelize.define('CollectionTask', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  task_no: {
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
  target_quantity: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  completed_quantity: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  task_status: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'pending'
  },
  priority: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'normal'
  },
  assigned_to: {
    type: DataTypes.INTEGER
  },
  due_date: {
    type: DataTypes.DATEONLY
  },
  completed_at: {
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
  tableName: 'collection_tasks',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

module.exports = CollectionTask;
