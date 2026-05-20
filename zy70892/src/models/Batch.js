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
    comment: '物料批号'
  },
  materialCode: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: '物料编码'
  },
  materialName: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: '物料名称'
  },
  quantity: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '数量'
  },
  productionDate: {
    type: DataTypes.DATE,
    allowNull: false,
    comment: '生产日期'
  },
  workstation: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: '生产工位'
  },
  operator: {
    type: DataTypes.STRING,
    comment: '操作员'
  },
  status: {
    type: DataTypes.ENUM('pending', 'processing', 'completed', 'returned', 'rejected'),
    defaultValue: 'pending',
    comment: '批次状态'
  },
  remark: {
    type: DataTypes.TEXT,
    comment: '备注'
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  updatedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'batches',
  timestamps: true
});

module.exports = Batch;
