const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Experiment = sequelize.define('Experiment', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: '实验名称'
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '实验描述'
  },
  status: {
    type: DataTypes.ENUM('draft', 'running', 'completed', 'failed'),
    defaultValue: 'draft',
    comment: '实验状态'
  },
  startTime: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: '实验开始时间'
  },
  endTime: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: '实验结束时间'
  },
  config: {
    type: DataTypes.JSON,
    allowNull: false,
    comment: '实验配置（包含策略ID列表、流量追踪ID等）'
  },
  result: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: '实验结果摘要'
  },
  metadata: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: '元数据'
  }
}, {
  tableName: 'experiments',
  comment: '实验表'
});

module.exports = Experiment;
