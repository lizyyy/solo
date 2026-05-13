const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const FlowRecord = sequelize.define('FlowRecord', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  flowType: {
    type: DataTypes.ENUM('delivery', 'inspection', 'return', 'payment'),
    allowNull: false
  },
  referenceId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  orderId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  fromStatus: {
    type: DataTypes.STRING
  },
  toStatus: {
    type: DataTypes.STRING
  },
  operator: {
    type: DataTypes.STRING,
    allowNull: false
  },
  operationTime: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  remarks: {
    type: DataTypes.TEXT
  }
}, {
  timestamps: true,
  tableName: 'flow_records'
});

module.exports = FlowRecord;
