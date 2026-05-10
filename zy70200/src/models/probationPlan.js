const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const { ProbationStatus } = require('../constants');

const ProbationPlan = sequelize.define('ProbationPlan', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  employeeId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  mentorId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  startDate: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  originalEndDate: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  currentEndDate: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  durationMonths: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM(...Object.values(ProbationStatus)),
    defaultValue: ProbationStatus.PENDING
  },
  extensionCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  goals: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  requirements: {
    type: DataTypes.TEXT
  },
  notes: {
    type: DataTypes.TEXT
  },
  approvedBy: {
    type: DataTypes.UUID
  },
  approvedAt: {
    type: DataTypes.DATE
  }
}, {
  tableName: 'probation_plans',
  timestamps: true,
  paranoid: true
});

module.exports = ProbationPlan;
