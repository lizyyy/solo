const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Tenant = require('./Tenant');
const User = require('./User');
const AuditLog = require('./AuditLog');

const SecurityIncident = sequelize.define('SecurityIncident', {
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
  auditLogId: {
    type: DataTypes.UUID,
    allowNull: true
  },
  type: {
    type: DataTypes.ENUM('UNAUTHORIZED_ACCESS', 'CROSS_TENANT_ACCESS', 'TOKEN_EXPIRED', 'REPEAT_SUBMISSION', 'ABNORMAL_BEHAVIOR', 'OTHER'),
    allowNull: false
  },
  severity: {
    type: DataTypes.ENUM('low', 'medium', 'high', 'critical'),
    defaultValue: 'medium'
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  details: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  ipAddress: {
    type: DataTypes.STRING(45),
    allowNull: true
  },
  status: {
    type: DataTypes.ENUM('open', 'investigating', 'resolved', 'dismissed'),
    defaultValue: 'open'
  },
  resolvedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  resolutionNotes: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  indexes: [
    {
      fields: ['tenantId', 'createdAt']
    },
    {
      fields: ['type', 'severity', 'status']
    }
  ]
});

module.exports = SecurityIncident;
