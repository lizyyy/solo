const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const FineRecord = sequelize.define('FineRecord', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4
  },
  fineNo: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: false
  },
  occupationApplicationId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  ruleType: {
    type: DataTypes.STRING,
    allowNull: false
  },
  ruleId: {
    type: DataTypes.UUID,
    allowNull: true
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  baseAmount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  multiplier: {
    type: DataTypes.FLOAT,
    defaultValue: 1.0
  },
  totalAmount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  status: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'PENDING'
  },
  issuedAt: {
    type: DataTypes.DATE
  },
  dueDate: {
    type: DataTypes.DATE
  },
  paidAt: {
    type: DataTypes.DATE
  },
  waivedAt: {
    type: DataTypes.DATE
  },
  waiverReason: {
    type: DataTypes.TEXT
  },
  disputedAt: {
    type: DataTypes.DATE
  },
  disputeReason: {
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
  metadata: {
    type: DataTypes.JSON,
    defaultValue: {}
  }
}, {
  tableName: 'fine_records',
  timestamps: true,
  paranoid: true,
  indexes: [
    {
      fields: ['fineNo'],
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

module.exports = FineRecord;
