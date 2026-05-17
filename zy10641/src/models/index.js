const sequelize = require('../config/database');
const Batch = require('./Batch');
const ReplayHistory = require('./ReplayHistory');
const ExportRecord = require('./ExportRecord');

Batch.hasMany(ReplayHistory, { foreignKey: 'batchId', as: 'replayHistories' });
ReplayHistory.belongsTo(Batch, { foreignKey: 'batchId', as: 'batch' });

module.exports = {
  sequelize,
  Batch,
  ReplayHistory,
  ExportRecord
};
