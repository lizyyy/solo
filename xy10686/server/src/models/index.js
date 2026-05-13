const sequelize = require('../config/database');
const MaterialOrder = require('./MaterialOrder');
const DeliveryNote = require('./DeliveryNote');
const InspectionRecord = require('./InspectionRecord');
const AuditLog = require('./AuditLog');
const FlowRecord = require('./FlowRecord');

MaterialOrder.hasMany(DeliveryNote, { foreignKey: 'orderId', as: 'deliveries' });
DeliveryNote.belongsTo(MaterialOrder, { foreignKey: 'orderId', as: 'order' });

MaterialOrder.hasMany(InspectionRecord, { foreignKey: 'orderId', as: 'inspections' });
InspectionRecord.belongsTo(MaterialOrder, { foreignKey: 'orderId', as: 'order' });

DeliveryNote.hasMany(InspectionRecord, { foreignKey: 'deliveryId', as: 'inspections' });
InspectionRecord.belongsTo(DeliveryNote, { foreignKey: 'deliveryId', as: 'delivery' });

module.exports = {
  sequelize,
  MaterialOrder,
  DeliveryNote,
  InspectionRecord,
  AuditLog,
  FlowRecord
};
