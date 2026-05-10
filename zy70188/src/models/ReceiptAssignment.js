const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ReceiptAssignment = sequelize.define('receipt_assignment', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  receipt_number: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
    comment: '收据号'
  },
  numeric_number: {
    type: DataTypes.BIGINT,
    allowNull: false,
    comment: '数值化号码，用于排序和检测'
  },
  segment_pool_id: {
    type: DataTypes.UUID,
    allowNull: false,
    comment: '所属号段池ID'
  },
  window_id: {
    type: DataTypes.STRING(50),
    allowNull: false,
    comment: '收费窗口ID'
  },
  window_name: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: '收费窗口名称'
  },
  operator_id: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: '操作员ID'
  },
  operator_name: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: '操作员名称'
  },
  business_id: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: '业务单据号'
  },
  business_type: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: '业务类型'
  },
  amount: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: true,
    comment: '金额'
  },
  status: {
    type: DataTypes.ENUM('used', 'voided', 'reprinted', 'recovered'),
    defaultValue: 'used',
    comment: '状态：used-正常使用，voided-已作废，reprinted-补打，recovered-回收复用'
  },
  void_reason: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '作废原因'
  },
  void_time: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: '作废时间'
  },
  assigned_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    comment: '分配时间'
  },
  used_at: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: '使用时间'
  },
  remarks: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '备注'
  }
}, {
  tableName: 'receipt_assignment',
  comment: '收据分配记录',
  indexes: [
    {
      name: 'idx_assign_receipt_number',
      unique: true,
      fields: ['receipt_number']
    },
    {
      name: 'idx_assign_window_id',
      fields: ['window_id']
    },
    {
      name: 'idx_assign_numeric_number',
      fields: ['numeric_number']
    },
    {
      name: 'idx_assign_status',
      fields: ['status']
    },
    {
      name: 'idx_assign_segment_pool_id',
      fields: ['segment_pool_id']
    }
  ]
});

module.exports = ReceiptAssignment;
