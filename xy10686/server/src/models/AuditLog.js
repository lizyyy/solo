const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const AuditLog = sequelize.define('AuditLog', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  entityType: {
    type: DataTypes.ENUM('order', 'delivery', 'inspection'),
    allowNull: false
  },
  entityId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  action: {
    type: DataTypes.ENUM('create', 'update', 'delete', 'submit', 'approve', 'reject', 'return'),
    allowNull: false
  },
  oldValues: {
    type: DataTypes.TEXT
  },
  newValues: {
    type: DataTypes.TEXT
  },
  changedFields: {
    type: DataTypes.TEXT
  },
  operator: {
    type: DataTypes.STRING,
    allowNull: false
  },
  remarks: {
    type: DataTypes.TEXT
  }
}, {
  timestamps: true,
  tableName: 'audit_logs'
});

module.exports = AuditLog;
