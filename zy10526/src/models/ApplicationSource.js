const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ApplicationSource = sequelize.define('ApplicationSource', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  sourceCode: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    comment: '来源编码'
  },
  sourceName: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: '来源名称'
  },
  sourceType: {
    type: DataTypes.ENUM('sales', 'customer_service', 'system', 'api', 'other'),
    allowNull: false,
    comment: '来源类型'
  },
  applicant: {
    type: DataTypes.STRING,
    comment: '申请人'
  },
  applicantDept: {
    type: DataTypes.STRING,
    comment: '申请人部门'
  },
  approvalFlow: {
    type: DataTypes.JSON,
    comment: '审批流程信息'
  },
  remark: {
    type: DataTypes.TEXT,
    comment: '备注说明'
  },
  metadata: {
    type: DataTypes.JSON,
    defaultValue: {},
    comment: '扩展字段'
  }
}, {
  tableName: 'application_sources',
  timestamps: true
});

module.exports = ApplicationSource;
