const sequelize = require('../config/database');
const Batch = require('./Batch');
const DeliveryNote = require('./DeliveryNote');
const WeighingRecord = require('./WeighingRecord');
const Photo = require('./Photo');
const LossRecord = require('./LossRecord');
const AuditLog = require('./AuditLog');
const Reconciliation = require('./Reconciliation');
const ExportRecord = require('./ExportRecord');

Batch.hasMany(DeliveryNote, { foreignKey: 'batchId', as: 'deliveryNotes' });
DeliveryNote.belongsTo(Batch, { foreignKey: 'batchId', as: 'batch' });

Batch.hasMany(WeighingRecord, { foreignKey: 'batchId', as: 'weighingRecords' });
WeighingRecord.belongsTo(Batch, { foreignKey: 'batchId', as: 'batch' });

Batch.hasMany(Photo, { foreignKey: 'batchId', as: 'photos' });
Photo.belongsTo(Batch, { foreignKey: 'batchId', as: 'batch' });

Batch.hasMany(LossRecord, { foreignKey: 'batchId', as: 'lossRecords' });
LossRecord.belongsTo(Batch, { foreignKey: 'batchId', as: 'batch' });

Batch.hasMany(AuditLog, { foreignKey: 'batchId', as: 'auditLogs' });
AuditLog.belongsTo(Batch, { foreignKey: 'batchId', as: 'batch' });

Batch.hasMany(Reconciliation, { foreignKey: 'batchId', as: 'reconciliations' });
Reconciliation.belongsTo(Batch, { foreignKey: 'batchId', as: 'batch' });

module.exports = {
  sequelize,
  Batch,
  DeliveryNote,
  WeighingRecord,
  Photo,
  LossRecord,
  AuditLog,
  Reconciliation,
  ExportRecord
};
