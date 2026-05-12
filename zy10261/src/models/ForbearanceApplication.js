const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ForbearanceApplication = sequelize.define('ForbearanceApplication', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  applicationNo: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  contractId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  installmentId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  applicantName: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  applicantPhone: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  reason: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  requestedDays: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '申请宽限天数',
  },
  partialPaymentAmount: {
    type: DataTypes.DECIMAL(15, 2),
    comment: '承诺部分还款金额',
  },
  sourceId: {
    type: DataTypes.STRING,
    comment: '外部来源ID，用于防重',
  },
  status: {
    type: DataTypes.ENUM('pending', 'approved', 'rejected', 'cancelled'),
    defaultValue: 'pending',
  },
  approvedDays: {
    type: DataTypes.INTEGER,
    comment: '审批宽限天数',
  },
  approver: {
    type: DataTypes.STRING,
  },
  approvalRemark: {
    type: DataTypes.TEXT,
  },
  approvalTime: {
    type: DataTypes.DATE,
  },
  operator: {
    type: DataTypes.STRING,
  },
  remark: {
    type: DataTypes.TEXT,
  },
});

module.exports = ForbearanceApplication;
