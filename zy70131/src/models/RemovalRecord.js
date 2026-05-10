const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const RemovalReason = {
  EXPIRED: 'expired',
  REVOKED: 'revoked',
  REGION_VIOLATION: 'region_violation',
  MANUAL: 'manual'
};

const RemovalStatus = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  FAILED: 'failed'
};

const RemovalRecord = sequelize.define('RemovalRecord', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    allowNull: false
  },
  removalCode: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
    field: 'removal_code'
  },
  authorizationId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'authorization_id'
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
  reason: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  reasonDetail: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'reason_detail'
  },
  ruleEvaluationResult: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'rule_evaluation_result'
  },
  status: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: RemovalStatus.PENDING
  },
  executedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'executed_at'
  },
  executedBy: {
    type: DataTypes.STRING(100),
    allowNull: true,
    field: 'executed_by'
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
  tableName: 'removal_records',
  timestamps: true,
  underscored: true
});

module.exports = { RemovalRecord, RemovalReason, RemovalStatus };
