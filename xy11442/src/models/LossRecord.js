const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const LossRecord = sequelize.define('LossRecord', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  lossNo: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    comment: '损耗单号',
  },
  deliveryNo: {
    type: DataTypes.STRING,
    comment: '送货单号',
  },
  supplierId: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: '供应商ID',
  },
  supplierName: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: '供应商名称',
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
  lossDate: {
    type: DataTypes.DATE,
    allowNull: false,
    comment: '损耗日期',
  },
  lossType: {
    type: DataTypes.ENUM('bad_fruit', 'secondary_sorting', 'other'),
    allowNull: false,
    comment: '损耗类型：坏果扣款/二次分拣损耗/其他',
  },
  lossCategory: {
    type: DataTypes.STRING,
    comment: '损耗细分类别',
  },
  deliveryQuantity: {
    type: DataTypes.DECIMAL(10, 2),
    comment: '送货数量',
  },
  actualWeight: {
    type: DataTypes.DECIMAL(10, 2),
    comment: '实际称重',
  },
  lossQuantity: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    comment: '损耗数量',
  },
  unit: {
    type: DataTypes.STRING,
    defaultValue: 'kg',
    comment: '单位',
  },
  unitPrice: {
    type: DataTypes.DECIMAL(10, 2),
    comment: '单价',
  },
  lossAmount: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    comment: '损耗金额',
  },
  isDuplicate: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: '是否重复计算',
  },
  duplicateSourceId: {
    type: DataTypes.UUID,
    comment: '重复来源记录ID',
  },
  sourceType: {
    type: DataTypes.ENUM('delivery', 'weighing', 'basket_return', 'manual'),
    comment: '数据来源类型',
  },
  sourceId: {
    type: DataTypes.UUID,
    comment: '来源记录ID',
  },
  status: {
    type: DataTypes.ENUM('pending', 'confirmed', 'adjusted', 'compensated', 'closed'),
    defaultValue: 'pending',
    comment: '状态',
  },
  confirmedBy: {
    type: DataTypes.STRING,
    comment: '确认人',
  },
  confirmedAt: {
    type: DataTypes.DATE,
    comment: '确认时间',
  },
  remark: {
    type: DataTypes.TEXT,
    comment: '备注',
  },
}, {
  tableName: 'loss_records',
  timestamps: true,
  paranoid: true,
  indexes: [
    { fields: ['lossNo'], unique: true },
    { fields: ['deliveryNo'] },
    { fields: ['supplierId'] },
    { fields: ['lossDate'] },
    { fields: ['lossType'] },
    { fields: ['status'] },
    { fields: ['isDuplicate'] },
  ],
});

module.exports = LossRecord;
