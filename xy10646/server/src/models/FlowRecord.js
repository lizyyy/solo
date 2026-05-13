const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const FlowRecord = sequelize.define('FlowRecord', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  sampleRecordId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  flowType: {
    type: DataTypes.ENUM('sample', 'transport', 'receive', 'test', 'complete', 'reject'),
    allowNull: false
  },
  operator: {
    type: DataTypes.STRING(50),
    allowNull: false,
    comment: '操作人'
  },
  operationTime: {
    type: DataTypes.DATE,
    allowNull: false
  },
  fromLocation: {
    type: DataTypes.STRING(100),
    comment: '来源地点'
  },
  toLocation: {
    type: DataTypes.STRING(100),
    comment: '目标地点'
  },
  isTimeout: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: '是否超时'
  },
  timeoutReason: {
    type: DataTypes.TEXT,
    comment: '超时原因'
  },
  isIntercepted: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: '是否被拦截'
  },
  interceptReason: {
    type: DataTypes.TEXT,
    comment: '拦截原因'
  },
  remarks: {
    type: DataTypes.TEXT
  }
}, {
  timestamps: true
});

module.exports = FlowRecord;
