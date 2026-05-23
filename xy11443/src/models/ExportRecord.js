const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ExportRecord = sequelize.define('ExportRecord', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  exportNo: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    comment: '导出编号'
  },
  batchIds: {
    type: DataTypes.TEXT,
    comment: '批次ID列表(JSON)'
  },
  batchNos: {
    type: DataTypes.TEXT,
    comment: '批次号列表(JSON)'
  },
  exportType: {
    type: DataTypes.ENUM('single_batch', 'multi_batch', 'date_range', 'supplier'),
    allowNull: false,
    comment: '导出类型'
  },
  exportFormat: {
    type: DataTypes.ENUM('json', 'csv', 'excel'),
    defaultValue: 'json',
    comment: '导出格式'
  },
  fileName: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: '文件名'
  },
  filePath: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: '文件路径'
  },
  fileSize: {
    type: DataTypes.INTEGER,
    comment: '文件大小(字节)'
  },
  recordCount: {
    type: DataTypes.INTEGER,
    comment: '记录数量'
  },
  exportData: {
    type: DataTypes.TEXT,
    comment: '导出数据快照(JSON)'
  },
  exportedBy: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: '导出人'
  },
  exportedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    comment: '导出时间'
  }
}, {
  tableName: 'export_records',
  indexes: [
    { fields: ['export_no'], unique: true },
    { fields: ['export_type'] },
    { fields: ['exported_by'] },
    { fields: ['exported_at'] }
  ]
});

module.exports = ExportRecord;
