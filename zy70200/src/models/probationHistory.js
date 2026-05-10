const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ProbationHistory = sequelize.define('ProbationHistory', {
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
  action: {
    type: DataTypes.STRING,
    allowNull: false
  },
  previousStatus: {
    type: DataTypes.STRING
  },
  newStatus: {
    type: DataTypes.STRING
  },
  performedBy: {
    type: DataTypes.UUID
  },
  performedByRole: {
    type: DataTypes.STRING
  },
  comment: {
    type: DataTypes.TEXT
  },
  metadata: {
    type: DataTypes.JSONB,
    defaultValue: {}
  },
  timestamp: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'probation_histories',
  timestamps: true,
  paranoid: true
});

module.exports = ProbationHistory;
