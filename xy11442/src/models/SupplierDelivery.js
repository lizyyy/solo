const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const SupplierDelivery = sequelize.define('SupplierDelivery', {
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
  deliveryNo: {
    type: DataTypes.STRING,
    allowNull: false,
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
  deliveryDate: {
    type: DataTypes.DATE,
    allowNull: false,
    comment: '送货日期',
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
  deliveryQuantity: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    comment: '送货数量',
  },
  unit: {
    type: DataTypes.STRING,
    defaultValue: 'kg',
    comment: '单位',
  },
  unitPrice: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    comment: '单价',
  },
  totalAmount: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    comment: '总金额',
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
  tableName: 'supplier_deliveries',
  timestamps: true,
  paranoid: true,
  indexes: [
    { fields: ['deliveryNo'] },
    { fields: ['supplierId'] },
    { fields: ['deliveryDate'] },
    { fields: ['productId'] },
    { fields: ['batchId'] },
  ],
});

module.exports = SupplierDelivery;
