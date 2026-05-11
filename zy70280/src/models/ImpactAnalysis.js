const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ImpactAnalysis = sequelize.define('ImpactAnalysis', {
  id: {
    type: DataTypes.STRING(20),
    primaryKey: true,
    allowNull: false
  },
  repairOrderId: {
    type: DataTypes.STRING(20),
    allowNull: false
  },
  closedValveIds: {
    type: DataTypes.TEXT,
    allowNull: false,
    comment: '关闭的阀门ID列表(JSON数组)'
  },
  analysisTime: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  affectedAreas: {
    type: DataTypes.TEXT,
    comment: '受影响区域(JSON)'
  },
  affectedCommunities: {
    type: DataTypes.TEXT,
    comment: '受影响小区(JSON数组)'
  },
  affectedHospitals: {
    type: DataTypes.TEXT,
    comment: '受影响医院(JSON数组)'
  },
  affectedFireHydrants: {
    type: DataTypes.TEXT,
    comment: '受影响消防栓(JSON数组)'
  },
  affectedPriorityUsers: {
    type: DataTypes.TEXT,
    comment: '受影响优先级用户(JSON数组)'
  },
  totalAffectedHouseholds: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  totalAffectedPopulation: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  status: {
    type: DataTypes.ENUM('draft', 'confirmed', 'updated', 'final'),
    allowNull: false,
    defaultValue: 'draft'
  },
  warningFlags: {
    type: DataTypes.TEXT,
    comment: '告警标志(JSON数组)'
  },
  needsReview: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: '是否需要人工复核'
  },
  reviewNotes: {
    type: DataTypes.TEXT,
    comment: '复核备注'
  },
  reviewer: {
    type: DataTypes.STRING(50),
    comment: '复核人'
  },
  reviewTime: {
    type: DataTypes.DATE,
    comment: '复核时间'
  }
}, {
  timestamps: true,
  tableName: 'impact_analysis'
});

module.exports = ImpactAnalysis;