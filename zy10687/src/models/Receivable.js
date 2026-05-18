const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Receivable = sequelize.define('Receivable', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4
  },
  receivableNo: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
    comment: '账款编号'
  },
  customerId: {
    type: DataTypes.UUID,
    allowNull: false,
    comment: '客户ID'
  },
  customerName: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: '客户名称'
  },
  amount: {
    type: DataTypes.DECIMAL(18, 2),
    allowNull: false,
    comment: '账款金额'
  },
  dueDate: {
    type: DataTypes.DATE,
    allowNull: false,
    comment: '到期日'
  },
  status: {
    type: DataTypes.ENUM('LOCKED', 'UNLOCK_APPLY', 'UNLOCKED', 'REJECTED'),
    defaultValue: 'LOCKED',
    comment: '状态：已锁定/解锁申请/已解锁/被拒绝'
  },
  lockReason: {
    type: DataTypes.TEXT,
    allowNull: false,
    comment: '锁定原因'
  },
  unlockMaterials: {
    type: DataTypes.JSON,
    comment: '解锁材料'
  },
  currentOperator: {
    type: DataTypes.STRING(50),
    comment: '当前处理人'
  },
  operationSource: {
    type: DataTypes.STRING(50),
    comment: '操作来源'
  },
  financeOrderId: {
    type: DataTypes.UUID,
    comment: '关联融资单ID'
  },
  financeOrderNo: {
    type: DataTypes.STRING(50),
    comment: '关联融资单编号'
  },
  financeFrozen: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    comment: '融资单是否冻结'
  },
  rejectReason: {
    type: DataTypes.TEXT,
    comment: '拒绝原因'
  }
}, {
  tableName: 'receivables',
  timestamps: true,
  paranoid: true
});

module.exports = Receivable;