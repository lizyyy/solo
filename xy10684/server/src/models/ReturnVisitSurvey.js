const { sequelize, DataTypes } = require('../database');

const ReturnVisitSurvey = sequelize.define('ReturnVisitSurvey', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  customerName: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: '客户名称'
  },
  phone: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: '联系电话'
  },
  businessType: {
    type: DataTypes.STRING,
    comment: '业务类型'
  },
  score: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '评分 1-10'
  },
  isLowScore: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: '是否低分'
  },
  lowScoreReasonId: {
    type: DataTypes.INTEGER,
    comment: '低分原因ID'
  },
  departmentId: {
    type: DataTypes.INTEGER,
    comment: '责任部门ID'
  },
  surveyTime: {
    type: DataTypes.DATE,
    comment: '回访时间'
  },
  status: {
    type: DataTypes.ENUM('pending', 'processing', 'completed', 'blocked', 'reviewing'),
    defaultValue: 'pending',
    comment: '状态: pending待处理, processing处理中, completed已完成, blocked已拦截, reviewing复核中'
  },
  createdBy: {
    type: DataTypes.STRING,
    comment: '创建人'
  },
  remark: {
    type: DataTypes.TEXT,
    comment: '备注'
  }
}, {
  tableName: 'return_visit_survey',
  timestamps: true,
  paranoid: true
});

module.exports = ReturnVisitSurvey;
