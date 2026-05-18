const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ImportLog = sequelize.define('ImportLog', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  batchId: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: '批次ID'
  },
  totalRows: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: '总行数'
  },
  successRows: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: '成功行数'
  },
  failedRows: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: '失败行数'
  },
  failedDetails: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: '失败详情'
  },
  importedBy: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: '导入人'
  },
  status: {
    type: DataTypes.ENUM('processing', 'completed', 'failed'),
    defaultValue: 'processing',
    comment: '状态'
  }
}, {
  tableName: 'import_logs',
  timestamps: true
});

module.exports = ImportLog;
