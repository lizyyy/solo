const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ReprintRecord = sequelize.define('reprint_record', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  receipt_assignment_id: {
    type: DataTypes.UUID,
    allowNull: false,
    comment: '原始收据分配记录ID'
  },
  receipt_number: {
    type: DataTypes.STRING(50),
    allowNull: false,
    comment: '收据号'
  },
  reprint_count: {
    type: DataTypes.INTEGER,
    defaultValue: 1,
    comment: '补打次数'
  },
  reprint_reason: {
    type: DataTypes.TEXT,
    allowNull: false,
    comment: '补打原因'
  },
  original_operator_id: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: '原始操作员ID'
  },
  reprint_operator_id: {
    type: DataTypes.STRING(50),
    allowNull: false,
    comment: '补打操作员ID'
  },
  reprint_operator_name: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: '补打操作员名称'
  },
  window_id: {
    type: DataTypes.STRING(50),
    allowNull: false,
    comment: '补打窗口ID'
  },
  reprint_time: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    comment: '补打时间'
  },
  is_approval_required: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: '是否需要审批'
  },
  approved_by: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: '审批人ID'
  },
  approved_at: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: '审批时间'
  },
  approval_status: {
    type: DataTypes.ENUM('pending', 'approved', 'rejected'),
    defaultValue: 'approved',
    comment: '审批状态'
  },
  remarks: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '备注'
  }
}, {
  tableName: 'reprint_record',
  comment: '补打记录',
  indexes: [
    {
      name: 'idx_reprint_receipt_assignment_id',
      fields: ['receipt_assignment_id']
    },
    {
      name: 'idx_reprint_receipt_number',
      fields: ['receipt_number']
    }
  ]
});

module.exports = ReprintRecord;
