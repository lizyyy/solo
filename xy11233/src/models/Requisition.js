const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const REQUISITION_STATUSES = {
  DRAFT: 'draft',
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  PARTIAL_ISSUED: 'partial_issued',
  FULLY_ISSUED: 'fully_issued',
  PARTIAL_RETURNED: 'partial_returned',
  FULLY_RETURNED: 'fully_returned',
  CANCELLED: 'cancelled'
};

const Requisition = sequelize.define('Requisition', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  requisition_no: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
    comment: '申领单号'
  },
  applicant_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '申领人ID'
  },
  applicant_name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: '申领人姓名'
  },
  department: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: '所属部门'
  },
  purpose: {
    type: DataTypes.TEXT,
    allowNull: false,
    comment: '申领用途'
  },
  experiment_name: {
    type: DataTypes.STRING(200),
    allowNull: true,
    comment: '实验项目名称'
  },
  expected_use_date: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: '预计使用日期'
  },
  status: {
    type: DataTypes.ENUM(Object.values(REQUISITION_STATUSES)),
    allowNull: false,
    defaultValue: REQUISITION_STATUSES.DRAFT,
    comment: '申领状态'
  },
  total_items: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: '申领项总数'
  },
  urgent: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: '是否紧急'
  },
  current_approver_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: '当前审批人ID'
  },
  current_approver_name: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: '当前审批人姓名'
  },
  remark: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '备注'
  },
  submitted_at: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: '提交时间'
  },
  approved_at: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: '审批通过时间'
  },
  rejected_at: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: '驳回时间'
  },
  fully_issued_at: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: '全部出库时间'
  },
  fully_returned_at: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: '全部归还时间'
  }
}, {
  tableName: 'requisitions',
  comment: '申领单表'
});

Requisition.REQUISITION_STATUSES = REQUISITION_STATUSES;

module.exports = Requisition;
