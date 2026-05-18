const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const TeamChangeHistory = sequelize.define('TeamChangeHistory', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  applicationId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '改队申请ID'
  },
  operationType: {
    type: DataTypes.ENUM('创建', '提交', '撤回', '审核通过', '审核拒绝', '修改', '人工处理', '添加备注', '保险同步', '分队校验', '取消'),
    allowNull: false,
    comment: '操作类型'
  },
  previousStatus: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: '操作前状态'
  },
  newStatus: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: '操作后状态'
  },
  operatorId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '操作人ID'
  },
  operatorName: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: '操作人姓名'
  },
  operationRemark: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '操作备注'
  },
  changedFields: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '变更字段(JSON格式)'
  },
  originalDataSnapshot: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '原始数据快照(JSON格式)'
  },
  newDataSnapshot: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '新数据快照(JSON格式)'
  },
  operationTime: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    allowNull: false,
    comment: '操作时间'
  }
}, {
  tableName: 'team_change_history',
  timestamps: false
});

module.exports = TeamChangeHistory;
