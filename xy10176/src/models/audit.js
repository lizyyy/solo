const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const { SampleStatus, StepType } = require('../constants/status');

const Audit = sequelize.define('Audit', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  sampleId: {
    type: DataTypes.UUID,
    allowNull: false,
    comment: '样本ID'
  },
  barcode: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: '样本条码'
  },
  stepType: {
    type: DataTypes.ENUM,
    values: Object.values(StepType),
    allowNull: false,
    comment: '操作步骤类型'
  },
  action: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: '操作动作（NORMAL/TRANSITION/EXCEPTION/RESOLVE）'
  },
  fromStatus: {
    type: DataTypes.ENUM,
    values: Object.values(SampleStatus),
    allowNull: true,
    comment: '操作前状态'
  },
  toStatus: {
    type: DataTypes.ENUM,
    values: Object.values(SampleStatus),
    allowNull: true,
    comment: '操作后状态'
  },
  handler: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: '操作人'
  },
  requestId: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: '请求ID'
  },
  durationMs: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: '该步骤耗时（毫秒）'
  },
  detail: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '详细信息（JSON字符串）'
  },
  isIdempotent: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: '是否为幂等重复请求'
  }
}, {
  timestamps: true,
  paranoid: false,
  indexes: [
    { fields: ['sampleId'] },
    { fields: ['barcode'] },
    { fields: ['stepType'] },
    { fields: ['requestId'] }
  ]
});

module.exports = Audit;
