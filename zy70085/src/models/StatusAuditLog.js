const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const StatusAuditLog = sequelize.define('StatusAuditLog', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4
  },
  entityType: {
    type: DataTypes.STRING,
    allowNull: false
  },
  entityId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  fromStatus: {
    type: DataTypes.STRING
  },
  toStatus: {
    type: DataTypes.STRING,
    allowNull: false
  },
  changedBy: {
    type: DataTypes.STRING
  },
  changeReason: {
    type: DataTypes.TEXT
  },
  previousVersion: {
    type: DataTypes.INTEGER
  },
  newVersion: {
    type: DataTypes.INTEGER
  },
  snapshot: {
    type: DataTypes.JSON,
    defaultValue: {}
  },
  metadata: {
    type: DataTypes.JSON,
    defaultValue: {}
  }
}, {
  tableName: 'status_audit_logs',
  timestamps: true,
  indexes: [
    {
      fields: ['entityType', 'entityId']
    },
    {
      fields: ['createdAt']
    }
  ]
});

module.exports = StatusAuditLog;
