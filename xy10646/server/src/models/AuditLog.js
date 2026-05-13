const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const AuditLog = sequelize.define('AuditLog', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  entityType: {
    type: DataTypes.STRING(50),
    allowNull: false,
    comment: '实体类型: samplingPoint, sampleBottle, sampleRecord'
  },
  entityId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  fieldName: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  oldValue: {
    type: DataTypes.TEXT,
    comment: '修改前值'
  },
  newValue: {
    type: DataTypes.TEXT,
    comment: '修改后值'
  },
  operator: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  operationTime: {
    type: DataTypes.DATE,
    allowNull: false
  }
}, {
  timestamps: true
});

module.exports = AuditLog;
