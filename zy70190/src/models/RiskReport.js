const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const RiskReport = sequelize.define('RiskReport', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4
  },
  shortageId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  reportNo: {
    type: DataTypes.STRING,
    allowNull: false
  },
  riskLevel: {
    type: DataTypes.ENUM('low', 'medium', 'high', 'critical'),
    allowNull: false
  },
  riskType: {
    type: DataTypes.STRING
  },
  description: {
    type: DataTypes.TEXT
  },
  impact: {
    type: DataTypes.TEXT
  },
  mitigation: {
    type: DataTypes.TEXT
  },
  reporter: {
    type: DataTypes.STRING
  },
  status: {
    type: DataTypes.ENUM('active', 'mitigated', 'resolved', 'closed'),
    defaultValue: 'active'
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  updatedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
});

module.exports = RiskReport;
