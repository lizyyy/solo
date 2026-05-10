const sequelize = require('../config/database');
const MaterialShortage = require('./MaterialShortage');
const CommitmentVersion = require('./CommitmentVersion');
const AffectedOrder = require('./AffectedOrder');
const UrgeTask = require('./UrgeTask');
const DeliveryReceipt = require('./DeliveryReceipt');
const RiskReport = require('./RiskReport');
const HistoryRecord = require('./HistoryRecord');
const BackgroundJob = require('./BackgroundJob');

MaterialShortage.hasMany(CommitmentVersion, {
  foreignKey: 'shortageId',
  as: 'commitments'
});

MaterialShortage.hasMany(AffectedOrder, {
  foreignKey: 'shortageId',
  as: 'affectedOrders'
});

MaterialShortage.hasMany(UrgeTask, {
  foreignKey: 'shortageId',
  as: 'urgeTasks'
});

MaterialShortage.hasMany(DeliveryReceipt, {
  foreignKey: 'shortageId',
  as: 'deliveryReceipts'
});

MaterialShortage.hasMany(RiskReport, {
  foreignKey: 'shortageId',
  as: 'riskReports'
});

MaterialShortage.hasMany(HistoryRecord, {
  foreignKey: 'shortageId',
  as: 'histories'
});

CommitmentVersion.belongsTo(MaterialShortage, {
  foreignKey: 'shortageId',
  as: 'shortage'
});

AffectedOrder.belongsTo(MaterialShortage, {
  foreignKey: 'shortageId',
  as: 'shortage'
});

UrgeTask.belongsTo(MaterialShortage, {
  foreignKey: 'shortageId',
  as: 'shortage'
});

DeliveryReceipt.belongsTo(MaterialShortage, {
  foreignKey: 'shortageId',
  as: 'shortage'
});

RiskReport.belongsTo(MaterialShortage, {
  foreignKey: 'shortageId',
  as: 'shortage'
});

HistoryRecord.belongsTo(MaterialShortage, {
  foreignKey: 'shortageId',
  as: 'shortage'
});

module.exports = {
  sequelize,
  MaterialShortage,
  CommitmentVersion,
  AffectedOrder,
  UrgeTask,
  DeliveryReceipt,
  RiskReport,
  HistoryRecord,
  BackgroundJob
};
