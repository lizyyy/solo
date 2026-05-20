const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Defect = sequelize.define('Defect', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  defectCode: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: '缺陷编码'
  },
  defectType: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: '缺陷类型'
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: false,
    comment: '缺陷描述'
  },
  severity: {
    type: DataTypes.ENUM('minor', 'major', 'critical'),
    defaultValue: 'minor',
    comment: '严重程度'
  },
  workstation: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: '发现工位'
  },
  responsibleStation: {
    type: DataTypes.STRING,
    comment: '责任工位'
  },
  discoveredBy: {
    type: DataTypes.STRING,
    comment: '发现人'
  },
  discoveredAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    comment: '发现时间'
  },
  rootCause: {
    type: DataTypes.TEXT,
    comment: '根本原因'
  },
  causeAnalysis: {
    type: DataTypes.TEXT,
    comment: '原因分析'
  },
  status: {
    type: DataTypes.ENUM('open', 'analyzing', 'fixing', 'verified', 'closed'),
    defaultValue: 'open',
    comment: '缺陷状态'
  },
  remark: {
    type: DataTypes.TEXT,
    comment: '备注'
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  updatedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'defects',
  timestamps: true
});

module.exports = Defect;
