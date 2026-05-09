const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const CountTask = sequelize.define('CountTask', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  taskNo: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true
  },
  name: {
    type: DataTypes.STRING(200),
    allowNull: false
  },
  warehouseId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM('draft', 'in_progress', 'completed', 'cancelled'),
    defaultValue: 'draft'
  },
  startDate: {
    type: DataTypes.DATE,
    allowNull: true
  },
  endDate: {
    type: DataTypes.DATE,
    allowNull: true
  },
  createdBy: {
    type: DataTypes.UUID,
    allowNull: false
  },
  completedBy: {
    type: DataTypes.UUID,
    allowNull: true
  },
  version: {
    type: DataTypes.INTEGER,
    defaultValue: 1,
    allowNull: false
  },
  remark: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  timestamps: true,
  tableName: 'count_tasks'
});

module.exports = CountTask;