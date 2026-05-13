const { sequelize, DataTypes } = require('../database');

const RevisitResult = sequelize.define('RevisitResult', {
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
  taskId: {
    type: DataTypes.INTEGER,
    comment: '补救任务ID'
  },
  revisitTime: {
    type: DataTypes.DATE,
    comment: '复访时间'
  },
  revisitResult: {
    type: DataTypes.ENUM('resolved', 'partially_resolved', 'unresolved', 'no_answer'),
    comment: '复访结果'
  },
  newScore: {
    type: DataTypes.INTEGER,
    comment: '新评分'
  },
  customerFeedback: {
    type: DataTypes.TEXT,
    comment: '客户反馈'
  },
  handledBy: {
    type: DataTypes.STRING,
    comment: '处理人'
  },
  modifyReason: {
    type: DataTypes.STRING,
    comment: '修改原因'
  },
  affectedRecords: {
    type: DataTypes.TEXT,
    comment: '影响记录（JSON）'
  }
}, {
  tableName: 'revisit_result',
  timestamps: true
});

module.exports = RevisitResult;
