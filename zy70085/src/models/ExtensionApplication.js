const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ExtensionApplication = sequelize.define('ExtensionApplication', {
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
  requestedEndDate: {
    type: DataTypes.DATE,
    allowNull: false
  },
  previousEndDate: {
    type: DataTypes.DATE,
    allowNull: false
  },
  extensionDays: {
    type: DataTypes.INTEGER,
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
  approvedAt: {
    type: DataTypes.DATE
  },
  approvalComment: {
    type: DataTypes.TEXT
  },
  rejectionReason: {
    type: DataTypes.TEXT
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
  sequence: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1
  },
  metadata: {
    type: DataTypes.JSON,
    defaultValue: {}
  }
}, {
  tableName: 'extension_applications',
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

module.exports = ExtensionApplication;
