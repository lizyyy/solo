const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ReplayResult = {
  PENDING: 'pending',
  SUCCESS: 'success',
  PARTIAL_SUCCESS: 'partial_success',
  FAILED: 'failed'
};

const ReplayHistory = sequelize.define('ReplayHistory', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4
  },
  batchId: {
    type: DataTypes.UUID,
    allowNull: false,
    comment: '批次ID'
  },
  replayNo: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '重放序号'
  },
  operator: {
    type: DataTypes.STRING(50),
    comment: '操作人'
  },
  status: {
    type: DataTypes.ENUM(...Object.values(ReplayResult)),
    defaultValue: ReplayResult.PENDING,
    comment: '重放结果'
  },
  totalCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: '本次重放总记录数'
  },
  successCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: '本次重放成功数'
  },
  failCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: '本次重放失败数'
  },
  conflictCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: '冲突记录数'
  },
  skipCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: '跳过记录数'
  },
  reason: {
    type: DataTypes.TEXT,
    comment: '重放原因说明'
  },
  failRecords: {
    type: DataTypes.JSON,
    comment: '失败记录详情'
  },
  conflictRecords: {
    type: DataTypes.JSON,
    comment: '冲突记录详情'
  },
  evidence: {
    type: DataTypes.JSON,
    comment: '重放证据'
  },
  startedAt: {
    type: DataTypes.DATE,
    comment: '开始时间'
  },
  finishedAt: {
    type: DataTypes.DATE,
    comment: '结束时间'
  }
}, {
  tableName: 'replay_histories',
  timestamps: true,
  indexes: [
    { fields: ['batchId'] },
    { fields: ['replayNo'] },
    { fields: ['createdAt'] }
  ]
});

ReplayHistory.Result = ReplayResult;

module.exports = ReplayHistory;
