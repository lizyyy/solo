const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const HistoryRecord = sequelize.define('HistoryRecord', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  module: {
    type: DataTypes.ENUM('user', 'warehouse', 'product', 'inventory', 'count_task', 'count_detail'),
    allowNull: false
  },
  action: {
    type: DataTypes.ENUM('create', 'update', 'delete', 'submit', 'approve', 'reject', 'complete', 'cancel'),
    allowNull: false
  },
  entityId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  entityType: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  entityName: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  oldValue: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  newValue: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  changedBy: {
    type: DataTypes.UUID,
    allowNull: true
  },
  changedByName: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  ipAddress: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  userAgent: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  remark: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  timestamps: true,
  tableName: 'history_records',
  indexes: [
    {
      name: 'idx_entity',
      fields: ['entityId', 'entityType']
    },
    {
      name: 'idx_module',
      fields: ['module', 'action']
    },
    {
      name: 'idx_changed',
      fields: ['changedBy']
    }
  ]
});

module.exports = HistoryRecord;