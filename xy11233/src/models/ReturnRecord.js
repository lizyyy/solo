const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const RETURN_STATUSES = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  REJECTED: 'rejected'
};

const ReturnRecord = sequelize.define('ReturnRecord', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  return_no: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
    comment: '归还单号'
  },
  requisition_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '申领单ID'
  },
  requisition_item_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '申领单项ID'
  },
  outbound_record_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '出库记录ID'
  },
  inventory_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '库存ID'
  },
  batch_no: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: '批次号'
  },
  reagent_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '试剂ID'
  },
  reagent_name: {
    type: DataTypes.STRING(200),
    allowNull: false,
    comment: '试剂名称'
  },
  quantity: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    comment: '归还数量'
  },
  unit: {
    type: DataTypes.STRING(20),
    allowNull: false,
    comment: '单位'
  },
  returner_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '归还人ID'
  },
  returner_name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: '归还人姓名'
  },
  receiver_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '接收人ID'
  },
  receiver_name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: '接收人姓名'
  },
  return_time: {
    type: DataTypes.DATE,
    allowNull: false,
    comment: '归还时间'
  },
  status: {
    type: DataTypes.ENUM(Object.values(RETURN_STATUSES)),
    allowNull: false,
    defaultValue: RETURN_STATUSES.PENDING,
    comment: '状态'
  },
  remaining_quantity: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    comment: '剩余未使用量'
  },
  usage_remark: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '使用情况说明'
  },
  condition: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '归还时状况'
  },
  remark: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '备注'
  }
}, {
  tableName: 'return_records',
  comment: '归还记录表'
});

ReturnRecord.RETURN_STATUSES = RETURN_STATUSES;

module.exports = ReturnRecord;
