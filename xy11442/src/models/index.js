const sequelize = require('../config/database');
const ImportBatch = require('./ImportBatch');
const SupplierDelivery = require('./SupplierDelivery');
const WeighingRecord = require('./WeighingRecord');
const BasketReturn = require('./BasketReturn');
const LossRecord = require('./LossRecord');
const CompensationQueue = require('./CompensationQueue');

ImportBatch.hasMany(SupplierDelivery, { foreignKey: 'batchId', as: 'deliveries' });
SupplierDelivery.belongsTo(ImportBatch, { foreignKey: 'batchId', as: 'batch' });

ImportBatch.hasMany(WeighingRecord, { foreignKey: 'batchId', as: 'weighingRecords' });
WeighingRecord.belongsTo(ImportBatch, { foreignKey: 'batchId', as: 'batch' });

ImportBatch.hasMany(BasketReturn, { foreignKey: 'batchId', as: 'basketReturns' });
BasketReturn.belongsTo(ImportBatch, { foreignKey: 'batchId', as: 'batch' });

SupplierDelivery.hasMany(LossRecord, { foreignKey: 'deliveryNo', sourceKey: 'deliveryNo', as: 'lossRecords' });
LossRecord.belongsTo(SupplierDelivery, { foreignKey: 'deliveryNo', targetKey: 'deliveryNo', as: 'delivery' });

LossRecord.hasMany(CompensationQueue, { foreignKey: 'lossRecordId', as: 'queueItems' });
CompensationQueue.belongsTo(LossRecord, { foreignKey: 'lossRecordId', as: 'lossRecord' });

module.exports = {
  sequelize,
  ImportBatch,
  SupplierDelivery,
  WeighingRecord,
  BasketReturn,
  LossRecord,
  CompensationQueue,
};
