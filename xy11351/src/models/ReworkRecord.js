const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ReworkRecord = sequelize.define('rework_record', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  printBatchId: {
    type: DataTypes.UUID,
    allowNull: false,
    comment: '印刷批次ID'
  },
  printBatchNo: {
    type: DataTypes.STRING(50),
    comment: '印刷批次号'
  },
  reworkNo: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
    comment: '返工单号'
  },
  reworkCount: {
    type: DataTypes.INTEGER,
    defaultValue: 1,
    comment: '第几次返工'
  },
  reason: {
    type: DataTypes.TEXT,
    allowNull: false,
    comment: '返工原因'
  },
  action: {
    type: DataTypes.TEXT,
    comment: '返工措施'
  },
  reworkQuantity: {
    type: DataTypes.INTEGER,
    comment: '返工数量'
  },
  reworkDate: {
    type: DataTypes.DATE,
    comment: '返工日期'
  },
  operator: {
    type: DataTypes.STRING(50),
    comment: '操作人'
  },
  result: {
    type: DataTypes.STRING(20),
    comment: '返工结果'
  },
  beforeQualityLevel: {
    type: DataTypes.STRING(20),
    comment: '返工前质量等级'
  },
  afterQualityLevel: {
    type: DataTypes.STRING(20),
    comment: '返工后质量等级'
  },
  verifiedBy: {
    type: DataTypes.STRING(50),
    comment: '验证人'
  },
  verifyTime: {
    type: DataTypes.DATE,
    comment: '验证时间'
  },
  remark: {
    type: DataTypes.TEXT,
    comment: '备注'
  }
}, {
  indexes: [
    { fields: ['printBatchId'] },
    { fields: ['printBatchNo'] },
    { fields: ['reworkDate'] },
    { fields: ['operator'] }
  ]
});

module.exports = ReworkRecord;
