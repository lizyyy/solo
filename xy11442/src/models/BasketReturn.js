const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const BasketReturn = sequelize.define('BasketReturn', {
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
  returnNo: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: '退筐单号',
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
    comment: '商品ID',
  },
  returnDate: {
    type: DataTypes.DATE,
    allowNull: false,
    comment: '退筐日期',
  },
  basketCount: {
    type: DataTypes.INTEGER,
    comment: '退筐数量',
  },
  badFruitWeight: {
    type: DataTypes.DECIMAL(10, 2),
    comment: '坏果重量',
  },
  unit: {
    type: DataTypes.STRING,
    defaultValue: 'kg',
    comment: '单位',
  },
  photoUrl: {
    type: DataTypes.STRING,
    comment: '照片路径/URL',
  },
  photoHash: {
    type: DataTypes.STRING,
    comment: '照片哈希',
  },
  returnReason: {
    type: DataTypes.TEXT,
    comment: '退回原因',
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
  tableName: 'basket_returns',
  timestamps: true,
  paranoid: true,
  indexes: [
    { fields: ['returnNo'] },
    { fields: ['deliveryNo'] },
    { fields: ['returnDate'] },
    { fields: ['batchId'] },
  ],
});

module.exports = BasketReturn;
