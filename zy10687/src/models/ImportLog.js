const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ImportLog = sequelize.define('ImportLog', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4
  },
  batchNo: {
    type: DataTypes.STRING(50),
    allowNull: false,
    comment: '导入批次号'
  },
  rowNumber: {
    type: DataTypes.INTEGER,
    comment: '行号'
  },
  rowData: {
    type: DataTypes.JSON,
    comment: '行数据'
  },
  status: {
    type: DataTypes.ENUM('SUCCESS', 'FAILED'),
    allowNull: false,
    comment: '状态'
  },
  errorMessage: {
    type: DataTypes.TEXT,
    comment: '错误信息'
  },
  operator: {
    type: DataTypes.STRING(50),
    comment: '操作者'
  }
}, {
  tableName: 'import_logs',
  timestamps: true
});

module.exports = ImportLog;