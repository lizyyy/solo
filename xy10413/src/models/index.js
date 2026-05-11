const sequelize = require('../db/database');

const Supplier = require('./Supplier');
const PurchaseOrder = require('./PurchaseOrder');
const PurchaseOrderItem = require('./PurchaseOrderItem');
const ToleranceRule = require('./ToleranceRule');
const ArrivalNote = require('./ArrivalNote');
const ArrivalNoteItem = require('./ArrivalNoteItem');
const InspectionResult = require('./InspectionResult');
const DiscrepancyHandling = require('./DiscrepancyHandling');
const Inventory = require('./Inventory');
const InventoryLog = require('./InventoryLog');

PurchaseOrder.belongsTo(Supplier, { foreignKey: 'supplierId' });
Supplier.hasMany(PurchaseOrder, { foreignKey: 'supplierId' });

PurchaseOrderItem.belongsTo(PurchaseOrder, { foreignKey: 'poId' });
PurchaseOrder.hasMany(PurchaseOrderItem, { foreignKey: 'poId' });

ArrivalNote.belongsTo(PurchaseOrder, { foreignKey: 'poId' });
ArrivalNote.belongsTo(Supplier, { foreignKey: 'supplierId' });
PurchaseOrder.hasMany(ArrivalNote, { foreignKey: 'poId' });

ArrivalNoteItem.belongsTo(ArrivalNote, { foreignKey: 'arrivalNoteId' });
ArrivalNoteItem.belongsTo(PurchaseOrderItem, { foreignKey: 'poItemId' });
ArrivalNote.hasMany(ArrivalNoteItem, { foreignKey: 'arrivalNoteId' });

InspectionResult.belongsTo(ArrivalNote, { foreignKey: 'arrivalNoteId' });
InspectionResult.belongsTo(ArrivalNoteItem, { foreignKey: 'arrivalNoteItemId' });
ArrivalNote.hasMany(InspectionResult, { foreignKey: 'arrivalNoteId' });
ArrivalNoteItem.hasMany(InspectionResult, { foreignKey: 'arrivalNoteItemId' });

DiscrepancyHandling.belongsTo(InspectionResult, { foreignKey: 'inspectionResultId' });
InspectionResult.hasMany(DiscrepancyHandling, { foreignKey: 'inspectionResultId' });

InventoryLog.belongsTo(Inventory, { foreignKey: 'inventoryId' });
Inventory.hasMany(InventoryLog, { foreignKey: 'inventoryId' });

module.exports = {
  sequelize,
  Supplier,
  PurchaseOrder,
  PurchaseOrderItem,
  ToleranceRule,
  ArrivalNote,
  ArrivalNoteItem,
  InspectionResult,
  DiscrepancyHandling,
  Inventory,
  InventoryLog
};
