const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ExportType = {
  BATCH_LIST: 'batch_list',
  FAIL_RECORDS: 'fail_records',
  REPLAY_HISTORY: 'replay_history'
};

const ExportStatus = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed'
};

const ExportRecord = sequelize.define('ExportRecord', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4
  },
  exportNo: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
    comment: '导出编号'
  },
  exportType: {
    type: DataTypes.ENUM(...Object.values(ExportType)),
    allowNull: false,
    comment: '导出类型'
  },
  status: {
    type: DataTypes.ENUM(...Object.values(ExportStatus)),
    defaultValue: ExportStatus.PENDING,
    comment: '导出状态'
  },
  fileName: {
    type: DataTypes.STRING(200),
    comment: '文件名'
  },
  filePath: {
    type: DataTypes.STRING(500),
    comment: '文件路径'
  },
  fileSize: {
    type: DataTypes.BIGINT,
    comment: '文件大小'
  },
  recordCount: {
    type: DataTypes.INTEGER,
    comment: '记录数'
  },
  operator: {
    type: DataTypes.STRING(50),
    comment: '操作人'
  },
  filters: {
    type: DataTypes.JSON,
    comment: '查询条件'
  },
  errorMsg: {
    type: DataTypes.TEXT,
    comment: '错误信息'
  },
  expiredAt: {
    type: DataTypes.DATE,
    comment: '过期时间'
  }
}, {
  tableName: 'export_records',
  timestamps: true,
  indexes: [
    { fields: ['exportNo'] },
    { fields: ['status'] },
    { fields: ['createdAt'] }
  ]
});

ExportRecord.Type = ExportType;
ExportRecord.Status = ExportStatus;

module.exports = ExportRecord;
