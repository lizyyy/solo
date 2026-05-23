const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Batch = sequelize.define('Batch', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  batchNo: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    comment: '批次号'
  },
  supplierId: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: '供应商ID'
  },
  supplierName: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: '供应商名称'
  },
  deliveryDate: {
    type: DataTypes.DATE,
    allowNull: false,
    comment: '送货日期'
  },
  status: {
    type: DataTypes.ENUM('pending', 'submitted', 'withdrawn', 'reconciled', 'frozen', 'exported'),
    defaultValue: 'pending',
    comment: '批次状态'
  },
  isFrozen: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: '是否冻结（导出前）'
  },
  frozenAt: {
    type: DataTypes.DATE,
    comment: '冻结时间'
  },
  frozenBy: {
    type: DataTypes.STRING,
    comment: '冻结操作人'
  },
  remark: {
    type: DataTypes.TEXT,
    comment: '客服备注'
  },
  createdBy: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: '创建人'
  },
  submitCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: '提交次数'
  },
  lastSubmittedAt: {
    type: DataTypes.DATE,
    comment: '最后提交时间'
  }
}, {
  tableName: 'batches',
  indexes: [
    { fields: ['batch_no'], unique: true },
    { fields: ['supplier_id'] },
    { fields: ['delivery_date'] },
    { fields: ['status'] }
  ]
});

module.exports = Batch;
