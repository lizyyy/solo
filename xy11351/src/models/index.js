const { sequelize } = require('../config/database');

const PaperBatch = require('./PaperBatch');
const PrintBatch = require('./PrintBatch');
const LabRecord = require('./LabRecord');
const QualityOrder = require('./QualityOrder');
const ReworkRecord = require('./ReworkRecord');

PrintBatch.belongsTo(PaperBatch, { foreignKey: 'paperBatchId', as: 'paperBatch' });
PaperBatch.hasMany(PrintBatch, { foreignKey: 'paperBatchId', as: 'printBatches' });

LabRecord.belongsTo(PrintBatch, { foreignKey: 'printBatchId', as: 'printBatch' });
PrintBatch.hasMany(LabRecord, { foreignKey: 'printBatchId', as: 'labRecords' });

QualityOrder.belongsTo(PrintBatch, { foreignKey: 'printBatchId', as: 'printBatch' });
PrintBatch.hasMany(QualityOrder, { foreignKey: 'printBatchId', as: 'qualityOrders' });

ReworkRecord.belongsTo(PrintBatch, { foreignKey: 'printBatchId', as: 'printBatch' });
PrintBatch.hasMany(ReworkRecord, { foreignKey: 'printBatchId', as: 'reworkRecords' });

const initDatabase = async () => {
  await sequelize.sync({ alter: false });
};

module.exports = {
  sequelize,
  initDatabase,
  PaperBatch,
  PrintBatch,
  LabRecord,
  QualityOrder,
  ReworkRecord
};
