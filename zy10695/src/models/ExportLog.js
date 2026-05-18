const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ExportLog = sequelize.define('ExportLog', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  exportId: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: '导出任务ID'
  },
  datasetCode: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: '数据集编码'
  },
  fields: {
    type: DataTypes.JSON,
    allowNull: false,
    comment: '导出字段列表'
  },
  expiredFields: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: '过期需重新审批的字段'
  },
  exportedBy: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: '导出人'
  },
  status: {
    type: DataTypes.ENUM('allowed', 'blocked', 'partial'),
    comment: '状态: allowed-全部允许, blocked-全部拦截, partial-部分拦截'
  }
}, {
  tableName: 'export_logs',
  timestamps: true
});

module.exports = ExportLog;
