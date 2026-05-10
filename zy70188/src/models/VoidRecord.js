const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const VoidRecord = sequelize.define('void_record', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  receipt_assignment_id: {
    type: DataTypes.UUID,
    allowNull: false,
    comment: '收据分配记录ID'
  },
  receipt_number: {
    type: DataTypes.STRING(50),
    allowNull: false,
    comment: '收据号'
  },
  numeric_number: {
    type: DataTypes.BIGINT,
    allowNull: false,
    comment: '数值化号码'
  },
  void_reason: {
    type: DataTypes.TEXT,
    allowNull: false,
    comment: '作废原因'
  },
  operator_id: {
    type: DataTypes.STRING(50),
    allowNull: false,
    comment: '作废操作员ID'
  },
  operator_name: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: '作废操作员名称'
  },
  window_id: {
    type: DataTypes.STRING(50),
    allowNull: false,
    comment: '收费窗口ID'
  },
  void_time: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    comment: '作废时间'
  },
  is_recoverable: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    comment: '是否可回收复用'
  },
  is_recovered: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: '是否已回收'
  },
  recovered_at: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: '回收时间'
  },
  recovered_by: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: '回收人ID'
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
  tableName: 'void_record',
  comment: '作废记录',
  indexes: [
    {
      name: 'idx_void_receipt_assignment_id',
      unique: true,
      fields: ['receipt_assignment_id']
    },
    {
      name: 'idx_void_receipt_number',
      fields: ['receipt_number']
    },
    {
      name: 'idx_void_numeric_number',
      fields: ['numeric_number']
    },
    {
      name: 'idx_void_is_recoverable',
      fields: ['is_recoverable', 'is_recovered']
    }
  ]
});

module.exports = VoidRecord;
