const { sequelize } = require('../database');
const ReturnVisitSurvey = require('./ReturnVisitSurvey');
const LowScoreReason = require('./LowScoreReason');
const Department = require('./Department');
const RemedyTask = require('./RemedyTask');
const RevisitResult = require('./RevisitResult');
const SatisfactionTrend = require('./SatisfactionTrend');
const OperationLog = require('./OperationLog');

ReturnVisitSurvey.belongsTo(LowScoreReason, { foreignKey: 'lowScoreReasonId', as: 'lowScoreReason' });
ReturnVisitSurvey.belongsTo(Department, { foreignKey: 'departmentId', as: 'department' });
ReturnVisitSurvey.hasMany(RemedyTask, { foreignKey: 'surveyId', as: 'tasks' });
ReturnVisitSurvey.hasMany(RevisitResult, { foreignKey: 'surveyId', as: 'revisitResults' });

RemedyTask.belongsTo(ReturnVisitSurvey, { foreignKey: 'surveyId', as: 'survey' });
RemedyTask.belongsTo(Department, { foreignKey: 'departmentId', as: 'department' });
RemedyTask.hasMany(RevisitResult, { foreignKey: 'taskId', as: 'revisitResults' });

RevisitResult.belongsTo(ReturnVisitSurvey, { foreignKey: 'surveyId', as: 'survey' });
RevisitResult.belongsTo(RemedyTask, { foreignKey: 'taskId', as: 'task' });

module.exports = {
  sequelize,
  ReturnVisitSurvey,
  LowScoreReason,
  Department,
  RemedyTask,
  RevisitResult,
  SatisfactionTrend,
  OperationLog
};
