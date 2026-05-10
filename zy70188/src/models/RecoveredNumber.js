const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const RecoveredNumber = sequelize.define('recovered_number', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  receipt_number: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
    comment: '回收的收据号'
  },
  numeric_number: {
    type: DataTypes.BIGINT,
    allowNull: false,
    comment: '数值化号码'
  },
  segment_pool_id: {
    type: DataTypes.UUID,
    allowNull: false,
    comment: '所属号段池ID'
  },
  original_window_id: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: '原始窗口ID'
  },
  void_record_id: {
    type: DataTypes.UUID,
    allowNull: false,
    comment: '作废记录ID'
  },
  recovered_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    comment: '回收时间'
  },
  is_used: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: '是否已被复用'
  },
  used_at: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: '复用时间'
  },
  used_by_window: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: '复用的窗口ID'
  },
  priority: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: '复用优先级，数值越大优先级越高'
  },
  remarks: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '备注'
  }
}, {
  tableName: 'recovered_number',
  comment: '回收号码池',
  indexes: [
    {
      name: 'idx_recovered_receipt_number',
      unique: true,
      fields: ['receipt_number']
    },
    {
      name: 'idx_recovered_segment_pool_id',
      fields: ['segment_pool_id', 'is_used']
    },
    {
      name: 'idx_recovered_numeric_number',
      fields: ['numeric_number']
    }
  ]
});

module.exports = RecoveredNumber;
