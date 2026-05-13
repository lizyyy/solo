const { sequelize, DataTypes } = require('../database');

const RemedyTask = sequelize.define('RemedyTask', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  surveyId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '回访问卷ID'
  },
  taskNo: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    comment: '任务编号'
  },
  assignee: {
    type: DataTypes.STRING,
    comment: '处理人'
  },
  departmentId: {
    type: DataTypes.INTEGER,
    comment: '处理部门ID'
  },
  priority: {
    type: DataTypes.ENUM('low', 'medium', 'high', 'urgent'),
    defaultValue: 'medium',
    comment: '优先级'
  },
  status: {
    type: DataTypes.ENUM('pending', 'assigned', 'processing', 'completed', 'cancelled', 'blocked'),
    defaultValue: 'pending',
    comment: '任务状态'
  },
  blockedReason: {
    type: DataTypes.STRING,
    comment: '拦截原因'
  },
  blockedRule: {
    type: DataTypes.STRING,
    comment: '拦截规则'
  },
  remedyContent: {
    type: DataTypes.TEXT,
    comment: '补救内容'
  },
  remedyResult: {
    type: DataTypes.TEXT,
    comment: '补救结果'
  },
  completedTime: {
    type: DataTypes.DATE,
    comment: '完成时间'
  },
  deadline: {
    type: DataTypes.DATE,
    comment: '截止时间'
  },
  needReview: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: '是否需要复核'
  },
  reviewedBy: {
    type: DataTypes.STRING,
    comment: '复核人'
  },
  reviewTime: {
    type: DataTypes.DATE,
    comment: '复核时间'
  },
  reviewResult: {
    type: DataTypes.ENUM('pass', 'reject'),
    comment: '复核结果'
  },
  reviewRemark: {
    type: DataTypes.TEXT,
    comment: '复核备注'
  }
}, {
  tableName: 'remedy_task',
  timestamps: true
});

module.exports = RemedyTask;
