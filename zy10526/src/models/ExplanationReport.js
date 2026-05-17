const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ExplanationReport = sequelize.define('ExplanationReport', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  reportCode: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    comment: '报告编号'
  },
  customerId: {
    type: DataTypes.UUID,
    allowNull: false,
    comment: '客户ID'
  },
  customerWhitelistId: {
    type: DataTypes.UUID,
    comment: '关联的白名单ID'
  },
  hitRecordId: {
    type: DataTypes.UUID,
    comment: '关联的命中记录ID'
  },
  reportType: {
    type: DataTypes.ENUM('single_hit', 'customer_summary', 'exception_analysis', 'manual_correction'),
    allowNull: false,
    comment: '报告类型'
  },
  status: {
    type: DataTypes.ENUM('generating', 'completed', 'failed'),
    defaultValue: 'generating',
    comment: '报告状态'
  },
  content: {
    type: DataTypes.TEXT,
    comment: '报告内容(JSON格式)'
  },
  summary: {
    type: DataTypes.TEXT,
    comment: '报告摘要'
  },
  generatedBy: {
    type: DataTypes.STRING,
    comment: '生成人/系统'
  },
  generatedAt: {
    type: DataTypes.DATE,
    comment: '生成时间'
  },
  exportedAt: {
    type: DataTypes.DATE,
    comment: '导出时间'
  },
  exportedBy: {
    type: DataTypes.STRING,
    comment: '导出人'
  },
  exportFormat: {
    type: DataTypes.ENUM('json', 'csv', 'pdf'),
    comment: '导出格式'
  },
  errorMessage: {
    type: DataTypes.TEXT,
    comment: '错误信息'
  }
}, {
  tableName: 'explanation_reports',
  timestamps: true
});

module.exports = ExplanationReport;
