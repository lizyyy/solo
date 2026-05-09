const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const OccupationApplication = sequelize.define('OccupationApplication', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4
  },
  applicationNo: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: false
  },
  contractorId: {
    type: DataTypes.STRING,
    allowNull: false
  },
  contractorName: {
    type: DataTypes.STRING,
    allowNull: false
  },
  projectName: {
    type: DataTypes.STRING,
    allowNull: false
  },
  projectType: {
    type: DataTypes.STRING,
    allowNull: false
  },
  roadSectionId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  occupiedLength: {
    type: DataTypes.FLOAT,
    allowNull: false
  },
  occupiedLanes: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1
  },
  startDate: {
    type: DataTypes.DATE,
    allowNull: false
  },
  endDate: {
    type: DataTypes.DATE,
    allowNull: false
  },
  originalEndDate: {
    type: DataTypes.DATE,
    allowNull: false
  },
  purpose: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  status: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'DRAFT'
  },
  submittedAt: {
    type: DataTypes.DATE
  },
  approvedAt: {
    type: DataTypes.DATE
  },
  completedAt: {
    type: DataTypes.DATE
  },
  approvalComment: {
    type: DataTypes.TEXT
  },
  rejectionReason: {
    type: DataTypes.TEXT
  },
  version: {
    type: DataTypes.INTEGER,
    defaultValue: 1,
    allowNull: false
  },
  hasActiveExtension: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  hasActiveFine: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  hasPendingWithdrawal: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  metadata: {
    type: DataTypes.JSON,
    defaultValue: {}
  }
}, {
  tableName: 'occupation_applications',
  timestamps: true,
  paranoid: true,
  indexes: [
    {
      fields: ['applicationNo'],
      unique: true
    },
    {
      fields: ['contractorId']
    },
    {
      fields: ['roadSectionId']
    },
    {
      fields: ['status']
    }
  ]
});

module.exports = OccupationApplication;
