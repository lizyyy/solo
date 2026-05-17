const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const BatchStatus = {
  SYNCING: 'syncing',
  FAILED: 'failed',
  REPLAYING: 'replaying',
  COMPLETED: 'completed'
};

const Batch = sequelize.define('Batch', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4
  },
  batchNo: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
    comment: '批次号'
  },
  dataSource: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: '数据源'
  },
  targetTable: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: '目标表'
  },
  status: {
    type: DataTypes.ENUM(...Object.values(BatchStatus)),
    allowNull: false,
    defaultValue: BatchStatus.SYNCING,
    comment: '状态'
  },
  totalCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: '总记录数'
  },
  successCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: '成功数'
  },
  failCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: '失败数'
  },
  failReason: {
    type: DataTypes.TEXT,
    comment: '失败原因'
  },
  failDetail: {
    type: DataTypes.JSON,
    comment: '失败详情'
  },
  hasPartialSuccess: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: '是否部分成功'
  },
  replayCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: '重放次数'
  },
  lastReplayAt: {
    type: DataTypes.DATE,
    comment: '最后重放时间'
  },
  createdBy: {
    type: DataTypes.STRING(50),
    comment: '创建人'
  },
  completedAt: {
    type: DataTypes.DATE,
    comment: '完成时间'
  }
}, {
  tableName: 'sync_batches',
  timestamps: true,
  indexes: [
    { fields: ['batchNo'] },
    { fields: ['status'] },
    { fields: ['dataSource'] },
    { fields: ['createdAt'] }
  ]
});

Batch.Status = BatchStatus;

module.exports = Batch;
