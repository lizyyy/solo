const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const AuthorizationStatus = {
  PENDING: 'pending',
  ACTIVE: 'active',
  EXPIRED: 'expired',
  REVOKED: 'revoked',
  SUSPENDED: 'suspended'
};

const AuthorizationScope = {
  FULL: 'full',
  PARTIAL: 'partial',
  CUSTOM: 'custom'
};

const Authorization = sequelize.define('Authorization', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    allowNull: false
  },
  authorizationCode: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
    field: 'authorization_code'
  },
  materialId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'material_id'
  },
  channelId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'channel_id'
  },
  channelName: {
    type: DataTypes.STRING(200),
    allowNull: false,
    field: 'channel_name'
  },
  scope: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: AuthorizationScope.FULL
  },
  scopeDescription: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'scope_description'
  },
  effectiveDate: {
    type: DataTypes.DATE,
    allowNull: false,
    field: 'effective_date'
  },
  expirationDate: {
    type: DataTypes.DATE,
    allowNull: false,
    field: 'expiration_date'
  },
  status: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: AuthorizationStatus.PENDING
  },
  revokedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'revoked_at'
  },
  revokedBy: {
    type: DataTypes.STRING(100),
    allowNull: true,
    field: 'revoked_by'
  },
  revocationReason: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'revocation_reason'
  },
  createdAt: {
    type: DataTypes.DATE,
    allowNull: false,
    field: 'created_at'
  },
  updatedAt: {
    type: DataTypes.DATE,
    allowNull: false,
    field: 'updated_at'
  }
}, {
  tableName: 'authorizations',
  timestamps: true,
  underscored: true
});

module.exports = { Authorization, AuthorizationStatus, AuthorizationScope };
