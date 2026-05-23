const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ImportBatch = sequelize.define('ImportBatch', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  sourceFileName: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: '来源文件名',
  },
  sourceFileType: {
    type: DataTypes.ENUM('delivery_note', 'weighing_record', 'basket_return'),
    allowNull: false,
    comment: '文件类型',
  },
  fileHash: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: '文件哈希，用于幂等检查',
  },
  totalRows: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: '总行数',
  },
  successRows: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: '成功行数',
  },
  failedRows: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: '失败行数',
  },
  status: {
    type: DataTypes.ENUM('pending', 'processing', 'completed', 'failed'),
    defaultValue: 'pending',
    comment: '导入状态',
  },
  importedBy: {
    type: DataTypes.STRING,
    comment: '导入人',
  },
  errorMessage: {
    type: DataTypes.TEXT,
    comment: '错误信息',
  },
}, {
  tableName: 'import_batches',
  timestamps: true,
  paranoid: true,
  indexes: [
    { fields: ['fileHash'] },
    { fields: ['sourceFileType'] },
    { fields: ['status'] },
  ],
});

module.exports = ImportBatch;
