const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const { ApprovalResult } = require('../constants');

const ExtensionRequest = sequelize.define('ExtensionRequest', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  probationPlanId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  employeeId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  requestedBy: {
    type: DataTypes.UUID,
    allowNull: false
  },
  extensionMonths: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  newEndDate: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  reason: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  improvementPlan: {
    type: DataTypes.TEXT
  },
  mentorRecommendation: {
    type: DataTypes.STRING
  },
  managerComment: {
    type: DataTypes.TEXT
  },
  status: {
    type: DataTypes.ENUM(...Object.values(ApprovalResult)),
    allowNull: true
  },
  approvedBy: {
    type: DataTypes.UUID
  },
  approvedAt: {
    type: DataTypes.DATE
  },
  rejectedBy: {
    type: DataTypes.UUID
  },
  rejectedAt: {
    type: DataTypes.DATE
  }
}, {
  tableName: 'extension_requests',
  timestamps: true,
  paranoid: true
});

module.exports = ExtensionRequest;
