const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const OperationLog = sequelize.define('OperationLog', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  accidentRecordId: {
    type: DataTypes.UUID,
    allowNull: false,
    comment: '事故记录ID'
  },
  operationType: {
    type: DataTypes.ENUM('create', 'update', 'submit', 'review', 'approve', 'reject', 'close'),
    allowNull: false,
    comment: '操作类型'
  },
  operator: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: '操作人'
  },
  beforeData: {
    type: DataTypes.JSON,
    comment: '操作前数据'
  },
  afterData: {
    type: DataTypes.JSON,
    comment: '操作后数据'
  },
  changes: {
    type: DataTypes.JSON,
    comment: '变更字段'
  },
  reason: {
    type: DataTypes.TEXT,
    comment: '操作原因'
  },
  ipAddress: {
    type: DataTypes.STRING,
    comment: '操作IP'
  }
}, {
  tableName: 'operation_logs',
  timestamps: true
});

module.exports = OperationLog;
