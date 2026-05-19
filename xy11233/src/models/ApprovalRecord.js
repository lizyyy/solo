const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const APPROVAL_ACTIONS = {
  APPROVE: 'approve',
  REJECT: 'reject',
  TRANSFER: 'transfer',
  REVISE: 'revise'
};

const ApprovalRecord = sequelize.define('ApprovalRecord', {
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
  requisition_item_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: '申领单项ID（单项审批时使用）'
  },
  approver_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '审批人ID'
  },
  approver_name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: '审批人姓名'
  },
  approver_role: {
    type: DataTypes.STRING(50),
    allowNull: false,
    comment: '审批人角色'
  },
  action: {
    type: DataTypes.ENUM(Object.values(APPROVAL_ACTIONS)),
    allowNull: false,
    comment: '审批动作'
  },
  approved_quantity: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    comment: '审批通过数量'
  },
  reason: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '审批意见/驳回原因'
  },
  next_approver_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: '下一审批人ID'
  },
  next_approver_name: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: '下一审批人姓名'
  },
  is_final: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: '是否为最终审批'
  }
}, {
  tableName: 'approval_records',
  comment: '审批记录表'
});

ApprovalRecord.APPROVAL_ACTIONS = APPROVAL_ACTIONS;

module.exports = ApprovalRecord;
