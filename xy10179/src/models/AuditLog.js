const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Tenant = require('./Tenant');
const User = require('./User');
const DataRecord = require('./DataRecord');

const AuditLog = sequelize.define('AuditLog', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  tenantId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: true
  },
  recordId: {
    type: DataTypes.UUID,
    allowNull: true
  },
  action: {
    type: DataTypes.ENUM('CREATE', 'READ', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'TENANT_SWITCH', 'UNAUTHORIZED_ACCESS'),
    allowNull: false
  },
  resourceType: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  resourceId: {
    type: DataTypes.UUID,
    allowNull: true
  },
  beforeState: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  afterState: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  ipAddress: {
    type: DataTypes.STRING(45),
    allowNull: true
  },
  userAgent: {
    type: DataTypes.STRING(500),
    allowNull: true
  },
  status: {
    type: DataTypes.ENUM('success', 'failure', 'warning'),
    defaultValue: 'success'
  },
  errorMessage: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  requestId: {
    type: DataTypes.STRING(100),
    allowNull: true
  }
}, {
  updatedAt: false,
  indexes: [
    {
      fields: ['tenantId', 'createdAt']
    },
    {
      fields: ['userId', 'action', 'createdAt']
    },
    {
      fields: ['recordId', 'createdAt']
    }
  ]
});

module.exports = AuditLog;
