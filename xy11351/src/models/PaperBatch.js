const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const PaperBatch = sequelize.define('paper_batch', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  batchNo: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
    comment: '纸张批次号'
  },
  paperType: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: '纸张类型'
  },
  supplier: {
    type: DataTypes.STRING(100),
    comment: '供应商'
  },
  weight: {
    type: DataTypes.DECIMAL(10, 2),
    comment: '克重(g/m²)'
  },
  receiveDate: {
    type: DataTypes.DATE,
    comment: '入库日期'
  },
  quantity: {
    type: DataTypes.INTEGER,
    comment: '数量(令)'
  },
  remark: {
    type: DataTypes.TEXT,
    comment: '备注'
  },
  createdBy: {
    type: DataTypes.STRING(50),
    comment: '创建人'
  }
}, {
  indexes: [
    { fields: ['batchNo'] },
    { fields: ['paperType'] },
    { fields: ['receiveDate'] }
  ]
});

module.exports = PaperBatch;
