const { DataTypes } = require('sequelize');
const sequelize = require('../database');

const ReviewRecord = sequelize.define('ReviewRecord', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  riskDetectionId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'risk_detection_id',
    references: {
      model: 'risk_detections',
      key: 'id',
    },
  },
  reviewer: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  originalStatus: {
    type: DataTypes.ENUM('pending', 'reviewed', 'overruled', 'resolved', 'ignored'),
    field: 'original_status',
  },
  newStatus: {
    type: DataTypes.ENUM('pending', 'reviewed', 'overruled', 'resolved', 'ignored'),
    field: 'new_status',
  },
  comment: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  reviewedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
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
  tableName: 'review_records',
  timestamps: true,
});

module.exports = ReviewRecord;
