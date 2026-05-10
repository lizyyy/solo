const sequelize = require('../config/database');

const Employee = require('./employee');
const ProbationPlan = require('./probationPlan');
const PerformanceEvaluation = require('./performanceEvaluation');
const MentorFeedback = require('./mentorFeedback');
const SalaryAdjustment = require('./salaryAdjustment');
const ProbationHistory = require('./probationHistory');
const ExtensionRequest = require('./extensionRequest');

Employee.hasMany(ProbationPlan, {
  foreignKey: 'employeeId',
  as: 'probationPlans'
});

ProbationPlan.belongsTo(Employee, {
  foreignKey: 'employeeId',
  as: 'employee'
});

ProbationPlan.belongsTo(Employee, {
  foreignKey: 'mentorId',
  as: 'mentor'
});

Employee.hasMany(ProbationPlan, {
  foreignKey: 'mentorId',
  as: 'mentoredProbations'
});

ProbationPlan.hasMany(PerformanceEvaluation, {
  foreignKey: 'probationPlanId',
  as: 'evaluations'
});

PerformanceEvaluation.belongsTo(ProbationPlan, {
  foreignKey: 'probationPlanId',
  as: 'probationPlan'
});

PerformanceEvaluation.belongsTo(Employee, {
  foreignKey: 'evaluatorId',
  as: 'evaluator'
});

ProbationPlan.hasMany(MentorFeedback, {
  foreignKey: 'probationPlanId',
  as: 'mentorFeedbacks'
});

MentorFeedback.belongsTo(ProbationPlan, {
  foreignKey: 'probationPlanId',
  as: 'probationPlan'
});

MentorFeedback.belongsTo(Employee, {
  foreignKey: 'mentorId',
  as: 'mentor'
});

ProbationPlan.hasMany(SalaryAdjustment, {
  foreignKey: 'probationPlanId',
  as: 'salaryAdjustments'
});

SalaryAdjustment.belongsTo(ProbationPlan, {
  foreignKey: 'probationPlanId',
  as: 'probationPlan'
});

SalaryAdjustment.belongsTo(Employee, {
  foreignKey: 'employeeId',
  as: 'employee'
});

ProbationPlan.hasMany(ProbationHistory, {
  foreignKey: 'probationPlanId',
  as: 'histories'
});

ProbationHistory.belongsTo(ProbationPlan, {
  foreignKey: 'probationPlanId',
  as: 'probationPlan'
});

ProbationHistory.belongsTo(Employee, {
  foreignKey: 'employeeId',
  as: 'employee'
});

ProbationPlan.hasMany(ExtensionRequest, {
  foreignKey: 'probationPlanId',
  as: 'extensionRequests'
});

ExtensionRequest.belongsTo(ProbationPlan, {
  foreignKey: 'probationPlanId',
  as: 'probationPlan'
});

ExtensionRequest.belongsTo(Employee, {
  foreignKey: 'employeeId',
  as: 'employee'
});

Employee.hasMany(ExtensionRequest, {
  foreignKey: 'requestedBy',
  as: 'requestedExtensions'
});

module.exports = {
  sequelize,
  Employee,
  ProbationPlan,
  PerformanceEvaluation,
  MentorFeedback,
  SalaryAdjustment,
  ProbationHistory,
  ExtensionRequest
};
