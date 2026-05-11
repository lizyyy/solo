const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const RepairOrder = sequelize.define('RepairOrder', {
  id: {
    type: DataTypes.STRING(20),
    primaryKey: true,
    allowNull: false
  },
  title: {
    type: DataTypes.STRING(200),
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  reportSource: {
    type: DataTypes.ENUM('citizen', 'patrol', 'alarm', 'scheduled'),
    allowNull: false,
    defaultValue: 'patrol'
  },
  status: {
    type: DataTypes.ENUM('pending', 'assigned', 'in_progress', 'waiting_review', 'completed', 'cancelled'),
    allowNull: false,
    defaultValue: 'pending'
  },
  priority: {
    type: DataTypes.ENUM('critical', 'high', 'medium', 'low'),
    allowNull: false,
    defaultValue: 'medium'
  },
  faultLocation: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  faultLongitude: {
    type: DataTypes.FLOAT,
    allowNull: false
  },
  faultLatitude: {
    type: DataTypes.FLOAT,
    allowNull: false
  },
  faultType: {
    type: DataTypes.STRING(50),
    comment: '故障类型'
  },
  affectedPipeId: {
    type: DataTypes.STRING(20),
    comment: '受影响管道ID'
  },
  closedValveIds: {
    type: DataTypes.TEXT,
    comment: '关闭的阀门ID列表(JSON数组)'
  },
  impactAnalysisId: {
    type: DataTypes.STRING(20),
    comment: '影响分析ID'
  },
  reportedBy: {
    type: DataTypes.STRING(50),
    comment: '报修人'
  },
  reportedPhone: {
    type: DataTypes.STRING(20),
    comment: '报修电话'
  },
  reportedTime: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  assignedTo: {
    type: DataTypes.STRING(50),
    comment: '指派给'
  },
  assignedTime: {
    type: DataTypes.DATE,
    comment: '指派时间'
  },
  startTime: {
    type: DataTypes.DATE,
    comment: '开始时间'
  },
  estimatedEndTime: {
    type: DataTypes.DATE,
    comment: '预计结束时间'
  },
  actualEndTime: {
    type: DataTypes.DATE,
    comment: '实际结束时间'
  },
  repairNotes: {
    type: DataTypes.TEXT,
    comment: '维修备注'
  },
  reviewNotes: {
    type: DataTypes.TEXT,
    comment: '复核备注'
  },
  reviewedBy: {
    type: DataTypes.STRING(50),
    comment: '复核人'
  },
  reviewedTime: {
    type: DataTypes.DATE,
    comment: '复核时间'
  }
}, {
  timestamps: true,
  tableName: 'repair_orders'
});

module.exports = RepairOrder;