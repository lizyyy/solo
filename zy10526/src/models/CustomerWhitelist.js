const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const CustomerWhitelist = sequelize.define('CustomerWhitelist', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  customerId: {
    type: DataTypes.UUID,
    allowNull: false,
    comment: '客户ID'
  },
  whitelistTypeId: {
    type: DataTypes.UUID,
    allowNull: false,
    comment: '白名单类型ID'
  },
  whitelistRuleId: {
    type: DataTypes.UUID,
    allowNull: false,
    comment: '白名单规则ID'
  },
  applicationSourceId: {
    type: DataTypes.UUID,
    allowNull: false,
    comment: '申请来源ID'
  },
  status: {
    type: DataTypes.ENUM('pending', 'active', 'expired', 'revoked', 'manual_corrected'),
    defaultValue: 'pending',
    comment: '白名单状态'
  },
  effectiveDate: {
    type: DataTypes.DATE,
    allowNull: false,
    comment: '生效日期'
  },
  expiryDate: {
    type: DataTypes.DATE,
    comment: '到期日期'
  },
  originalRequest: {
    type: DataTypes.JSON,
    comment: '原始请求数据，用于异常追踪'
  },
  processingBasis: {
    type: DataTypes.JSON,
    comment: '处理依据，用于审计'
  },
  manualCorrection: {
    type: DataTypes.JSON,
    comment: '人工修正信息'
  },
  createdBy: {
    type: DataTypes.STRING,
    comment: '创建人'
  },
  approvedBy: {
    type: DataTypes.STRING,
    comment: '审批人'
  },
  remark: {
    type: DataTypes.TEXT,
    comment: '备注'
  }
}, {
  tableName: 'customer_whitelists',
  timestamps: true,
  paranoid: true
});

module.exports = CustomerWhitelist;
