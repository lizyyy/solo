const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const WithdrawalApplication = sequelize.define('WithdrawalApplication', {
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
  occupationApplicationId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  requestedDate: {
    type: DataTypes.DATE,
    allowNull: false
  },
  reason: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  status: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'PENDING'
  },
  submittedAt: {
    type: DataTypes.DATE,
    allowNull: false
  },
  inspectionDate: {
    type: DataTypes.DATE
  },
  inspectionResult: {
    type: DataTypes.TEXT
  },
  inspectionScore: {
    type: DataTypes.FLOAT
  },
  requiredRepairs: {
    type: DataTypes.JSON,
    defaultValue: []
  },
  passedAt: {
    type: DataTypes.DATE
  },
  failedAt: {
    type: DataTypes.DATE
  },
  failureReason: {
    type: DataTypes.TEXT
  },
  reapplicationCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  version: {
    type: DataTypes.INTEGER,
    defaultValue: 1,
    allowNull: false
  },
  metadata: {
    type: DataTypes.JSON,
    defaultValue: {}
  }
}, {
  tableName: 'withdrawal_applications',
  timestamps: true,
  paranoid: true,
  indexes: [
    {
      fields: ['applicationNo'],
      unique: true
    },
    {
      fields: ['occupationApplicationId']
    },
    {
      fields: ['status']
    },
    {
      fields: ['occupationApplicationId', 'isActive']
    }
  ]
});

module.exports = WithdrawalApplication;
