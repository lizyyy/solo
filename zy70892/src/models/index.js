const sequelize = require('../config/database');
const Batch = require('./Batch');
const WorkOrder = require('./WorkOrder');
const Defect = require('./Defect');
const RepairRecord = require('./RepairRecord');
const ProcessHistory = require('./ProcessHistory');

WorkOrder.hasMany(RepairRecord, { foreignKey: 'workOrderId', as: 'repairRecords' });
RepairRecord.belongsTo(WorkOrder, { foreignKey: 'workOrderId', as: 'workOrder' });

Batch.hasMany(RepairRecord, { foreignKey: 'batchId', as: 'repairRecords' });
RepairRecord.belongsTo(Batch, { foreignKey: 'batchId', as: 'batch' });

Batch.hasMany(Defect, { foreignKey: 'batchId', as: 'defects' });
Defect.belongsTo(Batch, { foreignKey: 'batchId', as: 'batch' });

WorkOrder.hasMany(Defect, { foreignKey: 'workOrderId', as: 'defects' });
Defect.belongsTo(WorkOrder, { foreignKey: 'workOrderId', as: 'workOrder' });

RepairRecord.hasMany(Defect, { foreignKey: 'repairRecordId', as: 'defects' });
Defect.belongsTo(RepairRecord, { foreignKey: 'repairRecordId', as: 'repairRecord' });

RepairRecord.hasMany(ProcessHistory, {
  foreignKey: 'recordId',
  constraints: false,
  as: 'histories'
});

Batch.hasMany(ProcessHistory, {
  foreignKey: 'recordId',
  constraints: false,
  as: 'histories'
});

Defect.hasMany(ProcessHistory, {
  foreignKey: 'recordId',
  constraints: false,
  as: 'histories'
});

ProcessHistory.belongsTo(RepairRecord, {
  foreignKey: 'recordId',
  constraints: false,
  as: 'repairRecord'
});

module.exports = {
  sequelize,
  Batch,
  WorkOrder,
  Defect,
  RepairRecord,
  ProcessHistory
};
