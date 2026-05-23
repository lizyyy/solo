const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const CompensationQueue = sequelize.define('CompensationQueue', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  queueNo: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    comment: '队列编号',
  },
  jobType: {
    type: DataTypes.ENUM('loss_calculation', 'bad_fruit_deduction', 'secondary_sorting', 'duplicate_check', 'compensation', 'external_receipt'),
    allowNull: false,
    comment: '任务类型',
  },
  lossRecordId: {
    type: DataTypes.UUID,
    comment: '关联损耗记录ID',
  },
  deliveryNo: {
    type: DataTypes.STRING,
    comment: '送货单号',
  },
  supplierId: {
    type: DataTypes.STRING,
    comment: '供应商ID',
  },
  payload: {
    type: DataTypes.JSON,
    comment: '任务载荷数据',
  },
  status: {
    type: DataTypes.ENUM('pending', 'processing', 'waiting_retry', 'waiting_manual', 'permanent_failed', 'success', 'closed'),
    defaultValue: 'pending',
    comment: '状态：等待处理/处理中/等重试/等人工/永久失败/成功/已关闭',
  },
  retryCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: '已重试次数',
  },
  maxRetryCount: {
    type: DataTypes.INTEGER,
    defaultValue: 3,
    comment: '最大重试次数',
  },
  nextRetryAt: {
    type: DataTypes.DATE,
    comment: '下次重试时间',
  },
  lastError: {
    type: DataTypes.TEXT,
    comment: '最后错误信息',
  },
  lastErrorAt: {
    type: DataTypes.DATE,
    comment: '最后错误时间',
  },
  errorHistory: {
    type: DataTypes.JSON,
    defaultValue: () => [],
    comment: '错误历史',
  },
  handledBy: {
    type: DataTypes.STRING,
    comment: '处理人（人工接管时）',
  },
  handledAt: {
    type: DataTypes.DATE,
    comment: '处理时间（人工接管时）',
  },
  handleNote: {
    type: DataTypes.TEXT,
    comment: '处理备注',
  },
  compensationAmount: {
    type: DataTypes.DECIMAL(12, 2),
    comment: '补偿金额',
  },
  compensatedAt: {
    type: DataTypes.DATE,
    comment: '补偿入账时间',
  },
  externalReceiptId: {
    type: DataTypes.STRING,
    comment: '外部回执ID',
  },
  externalReceiptData: {
    type: DataTypes.JSON,
    comment: '外部回执数据',
  },
  closedBy: {
    type: DataTypes.STRING,
    comment: '关闭人',
  },
  closedAt: {
    type: DataTypes.DATE,
    comment: '关闭时间',
  },
  closeReason: {
    type: DataTypes.STRING,
    comment: '关闭原因',
  },
  bullJobId: {
    type: DataTypes.STRING,
    comment: 'Bull队列Job ID',
  },
}, {
  tableName: 'compensation_queues',
  timestamps: true,
  paranoid: true,
  indexes: [
    { fields: ['queueNo'], unique: true },
    { fields: ['jobType'] },
    { fields: ['status'] },
    { fields: ['lossRecordId'] },
    { fields: ['deliveryNo'] },
    { fields: ['supplierId'] },
    { fields: ['nextRetryAt'] },
    { fields: ['bullJobId'] },
  ],
});

module.exports = CompensationQueue;
