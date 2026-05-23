const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const WeighingRecord = sequelize.define('WeighingRecord', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  batchId: {
    type: DataTypes.UUID,
    allowNull: false,
    comment: '导入批次ID',
  },
  originalRowNumber: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '原始行号',
  },
  originalData: {
    type: DataTypes.JSON,
    allowNull: false,
    comment: '原始数据（不可修改）',
  },
  weighingNo: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: '称重单号',
  },
  deliveryNo: {
    type: DataTypes.STRING,
    comment: '关联送货单号',
  },
  supplierId: {
    type: DataTypes.STRING,
    comment: '供应商ID',
  },
  productId: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: '商品ID',
  },
  productName: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: '商品名称',
  },
  weighingDate: {
    type: DataTypes.DATE,
    allowNull: false,
    comment: '称重日期',
  },
  grossWeight: {
    type: DataTypes.DECIMAL(10, 2),
    comment: '毛重',
  },
  tareWeight: {
    type: DataTypes.DECIMAL(10, 2),
    comment: '皮重',
  },
  netWeight: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    comment: '净重',
  },
  unit: {
    type: DataTypes.STRING,
    defaultValue: 'kg',
    comment: '单位',
  },
  weigher: {
    type: DataTypes.STRING,
    comment: '称重人',
  },
  status: {
    type: DataTypes.ENUM('active', 'matched', 'closed'),
    defaultValue: 'active',
    comment: '状态',
  },
  parseStatus: {
    type: DataTypes.ENUM('success', 'warning', 'failed'),
    defaultValue: 'success',
    comment: '解析状态',
  },
  parseNote: {
    type: DataTypes.TEXT,
    comment: '解析备注',
  },
}, {
  tableName: 'weighing_records',
  timestamps: true,
  paranoid: true,
  indexes: [
    { fields: ['weighingNo'] },
    { fields: ['deliveryNo'] },
    { fields: ['weighingDate'] },
    { fields: ['productId'] },
    { fields: ['batchId'] },
  ],
});

module.exports = WeighingRecord;
