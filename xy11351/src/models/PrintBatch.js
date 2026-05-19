const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const { STATUS } = require('../config');

const PrintBatch = sequelize.define('print_batch', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  batchNo: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
    comment: '印刷批次号'
  },
  productName: {
    type: DataTypes.STRING(200),
    allowNull: false,
    comment: '产品名称'
  },
  paperBatchId: {
    type: DataTypes.UUID,
    comment: '纸张批次ID'
  },
  paperBatchNo: {
    type: DataTypes.STRING(50),
    comment: '纸张批次号'
  },
  printDate: {
    type: DataTypes.DATE,
    comment: '印刷日期'
  },
  quantity: {
    type: DataTypes.INTEGER,
    comment: '印刷数量'
  },
  targetL: {
    type: DataTypes.DECIMAL(5, 2),
    comment: '目标L值'
  },
  targetA: {
    type: DataTypes.DECIMAL(5, 2),
    comment: '目标A值'
  },
  targetB: {
    type: DataTypes.DECIMAL(5, 2),
    comment: '目标B值'
  },
  status: {
    type: DataTypes.ENUM(STATUS.PENDING, STATUS.CHECKED, STATUS.APPROVED, STATUS.REJECTED, STATUS.REWORKED),
    defaultValue: STATUS.PENDING,
    comment: '状态'
  },
  qualityLevel: {
    type: DataTypes.STRING(20),
    comment: '质量等级'
  },
  responsible: {
    type: DataTypes.STRING(50),
    comment: '负责人'
  },
  checker: {
    type: DataTypes.STRING(50),
    comment: '检测人'
  },
  reviewer: {
    type: DataTypes.STRING(50),
    comment: '复核人'
  },
  checkTime: {
    type: DataTypes.DATE,
    comment: '检测时间'
  },
  reviewTime: {
    type: DataTypes.DATE,
    comment: '复核时间'
  },
  exceptionType: {
    type: DataTypes.STRING(50),
    comment: '异常类型'
  },
  remark: {
    type: DataTypes.TEXT,
    comment: '备注'
  },
  reworkCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: '返工次数'
  }
}, {
  indexes: [
    { fields: ['batchNo'] },
    { fields: ['status'] },
    { fields: ['responsible'] },
    { fields: ['printDate'] },
    { fields: ['exceptionType'] }
  ]
});

module.exports = PrintBatch;
