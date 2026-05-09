const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const StatusHistory = sequelize.define('StatusHistory', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
    allowNull: false
  },
  lineStopId: {
    type: DataTypes.UUID,
    allowNull: false,
    comment: '停线事件ID'
  },
  fromStatus: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: '变更前状态'
  },
  toStatus: {
    type: DataTypes.STRING(50),
    allowNull: false,
    comment: '变更后状态'
  },
  operator: {
    type: DataTypes.STRING(50),
    allowNull: false,
    comment: '操作人'
  },
  reason: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '变更原因说明'
  },
  metadata: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '附加信息(JSON)'
  },
  timestamp: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    allowNull: false,
    comment: '变更时间'
  }
}, {
  tableName: 'status_history',
  timestamps: false,
  indexes: [
    {
      name: 'idx_line_stop_id',
      fields: ['lineStopId']
    },
    {
      name: 'idx_timestamp',
      fields: ['timestamp']
    }
  ]
});

module.exports = StatusHistory;
