const { DataTypes } = require('sequelize');
const sequelize = require('../database');

const RiskDetection = sequelize.define('RiskDetection', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  riskType: {
    type: DataTypes.ENUM(
      'missing_translation',
      'point_conflict',
      'temperature_drift',
      'duplicate_rework',
      'other'
    ),
    allowNull: false,
    field: 'risk_type',
  },
  pageNumber: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'page_number',
  },
  paragraphId: {
    type: DataTypes.STRING,
    allowNull: true,
    field: 'paragraph_id',
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  severity: {
    type: DataTypes.ENUM('high', 'medium', 'low'),
    defaultValue: 'medium',
  },
  detectedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    field: 'detected_at',
  },
  status: {
    type: DataTypes.ENUM('pending', 'reviewed', 'overruled', 'resolved', 'ignored'),
    defaultValue: 'pending',
  },
  reviewer: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  reviewComment: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'review_comment',
  },
  reviewedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'reviewed_at',
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    field: 'created_at',
  },
  updatedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    field: 'updated_at',
  },
}, {
  tableName: 'risk_detections',
  timestamps: true,
});

module.exports = RiskDetection;
