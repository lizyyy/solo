const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ReceivableHistory = sequelize.define('ReceivableHistory', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4
  },
  receivableId: {
    type: DataTypes.UUID,
    allowNull: false,
    comment: '账款ID'
  },
  receivableNo: {
    type: DataTypes.STRING(50),
    allowNull: false,
    comment: '账款编号'
  },
  operationType: {
    type: DataTypes.STRING(50),
    allowNull: false,
    comment: '操作类型：创建/申请解锁/审核通过/审核拒绝/系统处理'
  },
  operationSource: {
    type: DataTypes.STRING(50),
    allowNull: false,
    comment: '操作来源：WEB/API/系统/导入'
  },
  operator: {
    type: DataTypes.STRING(50),
    allowNull: false,
    comment: '操作者'
  },
  operatorId: {
    type: DataTypes.UUID,
    comment: '操作者ID'
  },
  oldStatus: {
    type: DataTypes.STRING(50),
    comment: '旧状态'
  },
  newStatus: {
    type: DataTypes.STRING(50),
    comment: '新状态'
  },
  oldData: {
    type: DataTypes.JSON,
    comment: '变更前数据'
  },
  newData: {
    type: DataTypes.JSON,
    comment: '变更后数据'
  },
  remark: {
    type: DataTypes.TEXT,
    comment: '备注'
  },
  financeFrozen: {
    type: DataTypes.BOOLEAN,
    comment: '融资单冻结状态'
  }
}, {
  tableName: 'receivable_histories',
  timestamps: true,
  indexes: [
    { fields: ['receivableId'] },
    { fields: ['receivableNo'] },
    { fields: ['createdAt'] }
  ]
});

module.exports = ReceivableHistory;