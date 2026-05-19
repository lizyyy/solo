const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const QualityOrder = sequelize.define('quality_order', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  orderNo: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
    comment: '质检单号'
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
  productName: {
    type: DataTypes.STRING(200),
    comment: '产品名称'
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
    comment: '数量'
  },
  avgL: {
    type: DataTypes.DECIMAL(5, 2),
    comment: '平均L值'
  },
  avgA: {
    type: DataTypes.DECIMAL(5, 2),
    comment: '平均A值'
  },
  avgB: {
    type: DataTypes.DECIMAL(5, 2),
    comment: '平均B值'
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
  maxDeltaE: {
    type: DataTypes.DECIMAL(5, 2),
    comment: '最大色差'
  },
  passRate: {
    type: DataTypes.DECIMAL(5, 2),
    comment: '合格率'
  },
  qualityLevel: {
    type: DataTypes.STRING(20),
    comment: '质量等级'
  },
  conclusion: {
    type: DataTypes.TEXT,
    comment: '质检结论'
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
  generatedBy: {
    type: DataTypes.STRING(50),
    comment: '生成人'
  },
  generateTime: {
    type: DataTypes.DATE,
    comment: '生成时间'
  }
}, {
  indexes: [
    { fields: ['orderNo'] },
    { fields: ['printBatchId'] },
    { fields: ['generateTime'] },
    { fields: ['responsible'] }
  ]
});

module.exports = QualityOrder;
