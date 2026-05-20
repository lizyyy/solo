const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const RepairRecord = sequelize.define('RepairRecord', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  recordNo: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    comment: '返修记录编号'
  },
  serialNo: {
    type: DataTypes.STRING,
    comment: '产品序列号'
  },
  workstation: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: '返修工位'
  },
  responsibleStation: {
    type: DataTypes.STRING,
    comment: '责任工位'
  },
  operator: {
    type: DataTypes.STRING,
    comment: '操作员'
  },
  handler: {
    type: DataTypes.STRING,
    comment: '处理人'
  },
  defectDescription: {
    type: DataTypes.TEXT,
    allowNull: false,
    comment: '缺陷描述'
  },
  rootCause: {
    type: DataTypes.TEXT,
    comment: '根本原因'
  },
  solution: {
    type: DataTypes.TEXT,
    comment: '处理方案'
  },
  materialsUsed: {
    type: DataTypes.TEXT,
    comment: '使用物料'
  },
  repairTime: {
    type: DataTypes.INTEGER,
    comment: '返修耗时(分钟)'
  },
  status: {
    type: DataTypes.ENUM('pending', 'processing', 'completed', 'returned', 'released', 'rejected'),
    defaultValue: 'pending',
    comment: '返修状态'
  },
  isClosed: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: '是否闭环'
  },
  closedAt: {
    type: DataTypes.DATE,
    comment: '闭环时间'
  },
  closedBy: {
    type: DataTypes.STRING,
    comment: '闭环人'
  },
  releaseReason: {
    type: DataTypes.TEXT,
    comment: '放行原因'
  },
  returnReason: {
    type: DataTypes.TEXT,
    comment: '退回原因'
  },
  materialSupplement: {
    type: DataTypes.TEXT,
    comment: '补材料要求'
  },
  processedAt: {
    type: DataTypes.DATE,
    comment: '处理时间'
  },
  processedBy: {
    type: DataTypes.STRING,
    comment: '处理人'
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
  tableName: 'repair_records',
  timestamps: true
});

module.exports = RepairRecord;
