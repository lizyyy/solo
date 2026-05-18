const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Exemption = sequelize.define('Exemption', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  datasetName: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: '数据集名称'
  },
  datasetCode: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: '数据集编码'
  },
  fieldName: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: '字段名称（支持嵌套JSON路径）'
  },
  fieldAlias: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: '字段别名'
  },
  fieldPath: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: '嵌套JSON字段路径，如 user.profile.contact.phone'
  },
  exemptionReason: {
    type: DataTypes.TEXT,
    allowNull: false,
    comment: '豁免原因'
  },
  approver: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: '审批人'
  },
  approverEmail: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: '审批人邮箱'
  },
  expireDate: {
    type: DataTypes.DATE,
    allowNull: false,
    comment: '到期时间'
  },
  status: {
    type: DataTypes.ENUM('active', 'expired', 'revoked'),
    defaultValue: 'active',
    comment: '状态: active-生效中, expired-已过期, revoked-已撤销'
  },
  createdBy: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: '创建人'
  },
  isNestedJson: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: '是否嵌套JSON字段'
  },
  metadata: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: '扩展元数据'
  }
}, {
  tableName: 'exemption_approvals',
  timestamps: true,
  paranoid: true,
  indexes: [
    { fields: ['datasetCode', 'fieldName', 'fieldPath'] },
    { fields: ['expireDate'] },
    { fields: ['status'] },
    { fields: ['approver'] }
  ]
});

module.exports = Exemption;
