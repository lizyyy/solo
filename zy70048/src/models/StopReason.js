const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const StopReason = sequelize.define('StopReason', {
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
  category: {
    type: DataTypes.ENUM,
    values: ['EQUIPMENT', 'MATERIAL', 'PERSONNEL', 'OTHER'],
    allowNull: false,
    comment: '原因类别: 设备、物料、人员、其他'
  },
  subCategory: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: '子类，如: 机械故障、电气故障、缺料、质量问题等'
  },
  source: {
    type: DataTypes.STRING(50),
    allowNull: false,
    comment: '记录来源: 设备日志、物料系统、人工记录等'
  },
  reporter: {
    type: DataTypes.STRING(50),
    allowNull: false,
    comment: '报告人'
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: false,
    comment: '原因描述'
  },
  evidence: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '证据(图片、日志、文档等)'
  },
  timestamp: {
    type: DataTypes.DATE,
    allowNull: false,
    comment: '原因记录时间'
  },
  isPrimary: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: '是否为主要原因'
  },
  confidence: {
    type: DataTypes.DECIMAL(3, 2),
    defaultValue: 0.0,
    comment: '置信度 0-1'
  },
  status: {
    type: DataTypes.ENUM,
    values: ['PENDING', 'CONFIRMED', 'REJECTED'],
    defaultValue: 'PENDING',
    comment: '原因状态'
  },
  rejectReason: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '拒绝原因'
  },
  version: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    allowNull: false,
    comment: '版本号'
  }
}, {
  tableName: 'stop_reasons',
  timestamps: true,
  paranoid: true,
  hooks: {
    beforeUpdate: (reason) => {
      reason.version += 1;
    }
  }
});

module.exports = StopReason;
