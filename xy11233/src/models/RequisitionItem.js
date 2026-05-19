const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ITEM_STATUSES = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  PARTIAL_ISSUED: 'partial_issued',
  FULLY_ISSUED: 'fully_issued',
  PARTIAL_RETURNED: 'partial_returned',
  FULLY_RETURNED: 'fully_returned',
  CANCELLED: 'cancelled'
};

const RequisitionItem = sequelize.define('RequisitionItem', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  requisition_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '申领单ID'
  },
  reagent_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '试剂ID'
  },
  reagent_code: {
    type: DataTypes.STRING(50),
    allowNull: false,
    comment: '试剂编码'
  },
  reagent_name: {
    type: DataTypes.STRING(200),
    allowNull: false,
    comment: '试剂名称'
  },
  hazard_level: {
    type: DataTypes.STRING(20),
    allowNull: true,
    comment: '危险等级'
  },
  unit: {
    type: DataTypes.STRING(20),
    allowNull: false,
    comment: '单位'
  },
  requested_quantity: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    comment: '申请数量'
  },
  approved_quantity: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    comment: '审批数量'
  },
  issued_quantity: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
    comment: '已出库数量'
  },
  returned_quantity: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
    comment: '已归还数量'
  },
  status: {
    type: DataTypes.ENUM(Object.values(ITEM_STATUSES)),
    allowNull: false,
    defaultValue: ITEM_STATUSES.PENDING,
    comment: '状态'
  },
  approval_remark: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '审批意见'
  },
  remark: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '备注'
  }
}, {
  tableName: 'requisition_items',
  comment: '申领单项表'
});

RequisitionItem.ITEM_STATUSES = ITEM_STATUSES;

module.exports = RequisitionItem;
