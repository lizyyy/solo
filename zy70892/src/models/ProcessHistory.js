const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ProcessHistory = sequelize.define('ProcessHistory', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  action: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: '操作类型'
  },
  previousStatus: {
    type: DataTypes.STRING,
    comment: '之前状态'
  },
  newStatus: {
    type: DataTypes.STRING,
    comment: '新状态'
  },
  reason: {
    type: DataTypes.TEXT,
    comment: '操作原因'
  },
  operator: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: '操作人'
  },
  operatedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    comment: '操作时间'
  },
  remark: {
    type: DataTypes.TEXT,
    comment: '备注'
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'process_histories',
  timestamps: false
});

module.exports = ProcessHistory;
