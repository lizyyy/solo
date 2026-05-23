const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Reconciliation = sequelize.define('Reconciliation', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  batchId: {
    type: DataTypes.UUID,
    allowNull: false,
    comment: '批次ID'
  },
  reconcileNo: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    comment: '对账编号'
  },
  deliveryWeight: {
    type: DataTypes.DECIMAL(10, 2),
    comment: '送货总重量'
  },
  netWeight: {
    type: DataTypes.DECIMAL(10, 2),
    comment: '净重量'
  },
  sortingWeight: {
    type: DataTypes.DECIMAL(10, 2),
    comment: '分拣后重量'
  },
  totalLossWeight: {
    type: DataTypes.DECIMAL(10, 2),
    comment: '总损耗重量'
  },
  badFruitLoss: {
    type: DataTypes.DECIMAL(10, 2),
    comment: '坏果损耗'
  },
  secondarySortingLoss: {
    type: DataTypes.DECIMAL(10, 2),
    comment: '二次分拣损耗'
  },
  otherLoss: {
    type: DataTypes.DECIMAL(10, 2),
    comment: '其他损耗'
  },
  totalLossRate: {
    type: DataTypes.DECIMAL(5, 2),
    comment: '总损耗率(%)'
  },
  totalDeduction: {
    type: DataTypes.DECIMAL(12, 2),
    comment: '总扣款金额'
  },
  differenceWeight: {
    type: DataTypes.DECIMAL(10, 2),
    comment: '差异重量'
  },
  differenceRemark: {
    type: DataTypes.TEXT,
    comment: '差异说明'
  },
  beforeData: {
    type: DataTypes.TEXT,
    comment: '对账前数据快照(JSON)'
  },
  afterData: {
    type: DataTypes.TEXT,
    comment: '对账后数据快照(JSON)'
  },
  status: {
    type: DataTypes.ENUM('pending', 'completed', 'adjusted'),
    defaultValue: 'pending',
    comment: '对账状态'
  },
  reconciledBy: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: '对账人'
  },
  reconciledAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    comment: '对账时间'
  }
}, {
  tableName: 'reconciliations',
  indexes: [
    { fields: ['batch_id'] },
    { fields: ['reconcile_no'], unique: true },
    { fields: ['status'] }
  ]
});

module.exports = Reconciliation;
