const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const { SampleStatus } = require('../constants/status');

const Sample = sequelize.define('Sample', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  barcode: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    comment: '样本条码，唯一标识'
  },
  status: {
    type: DataTypes.ENUM,
    values: Object.values(SampleStatus),
    defaultValue: SampleStatus.INIT,
    comment: '样本当前状态'
  },
  exceptionReason: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '异常原因'
  },
  handler: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: '当前处理人'
  },
  collectTime: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: '采集时间'
  },
  centrifugeTime: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: '离心时间'
  },
  testTime: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: '上机时间'
  },
  reviewTime: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: '复核时间'
  },
  requestIdCollect: {
    type: DataTypes.STRING,
    allowNull: true,
    unique: true,
    comment: '采集请求ID，用于幂等'
  },
  requestIdCentrifuge: {
    type: DataTypes.STRING,
    allowNull: true,
    unique: true,
    comment: '离心请求ID，用于幂等'
  },
  requestIdTest: {
    type: DataTypes.STRING,
    allowNull: true,
    unique: true,
    comment: '上机请求ID，用于幂等'
  },
  requestIdReview: {
    type: DataTypes.STRING,
    allowNull: true,
    unique: true,
    comment: '复核请求ID，用于幂等'
  }
}, {
  timestamps: true,
  paranoid: true,
  indexes: [
    { fields: ['barcode'] },
    { fields: ['status'] }
  ]
});

module.exports = Sample;
