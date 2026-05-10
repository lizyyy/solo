const sequelize = require('../config/database');
const SegmentPool = require('./SegmentPool');
const ReceiptAssignment = require('./ReceiptAssignment');
const VoidRecord = require('./VoidRecord');
const ReprintRecord = require('./ReprintRecord');
const RecoveredNumber = require('./RecoveredNumber');
const GapDetection = require('./GapDetection');
const AuditLog = require('./AuditLog');
const CompensationTask = require('./CompensationTask');

SegmentPool.hasMany(ReceiptAssignment, {
  foreignKey: 'segment_pool_id',
  as: 'assignments'
});

ReceiptAssignment.belongsTo(SegmentPool, {
  foreignKey: 'segment_pool_id',
  as: 'segmentPool'
});

ReceiptAssignment.hasOne(VoidRecord, {
  foreignKey: 'receipt_assignment_id',
  as: 'voidRecord'
});

VoidRecord.belongsTo(ReceiptAssignment, {
  foreignKey: 'receipt_assignment_id',
  as: 'assignment'
});

ReceiptAssignment.hasMany(ReprintRecord, {
  foreignKey: 'receipt_assignment_id',
  as: 'reprintRecords'
});

ReprintRecord.belongsTo(ReceiptAssignment, {
  foreignKey: 'receipt_assignment_id',
  as: 'assignment'
});

VoidRecord.hasOne(RecoveredNumber, {
  foreignKey: 'void_record_id',
  as: 'recoveredNumber'
});

RecoveredNumber.belongsTo(VoidRecord, {
  foreignKey: 'void_record_id',
  as: 'voidRecord'
});

RecoveredNumber.belongsTo(SegmentPool, {
  foreignKey: 'segment_pool_id',
  as: 'segmentPool'
});

SegmentPool.hasMany(RecoveredNumber, {
  foreignKey: 'segment_pool_id',
  as: 'recoveredNumbers'
});

GapDetection.belongsTo(SegmentPool, {
  foreignKey: 'segment_pool_id',
  as: 'segmentPool'
});

SegmentPool.hasMany(GapDetection, {
  foreignKey: 'segment_pool_id',
  as: 'gapDetections'
});

module.exports = {
  sequelize,
  SegmentPool,
  ReceiptAssignment,
  VoidRecord,
  ReprintRecord,
  RecoveredNumber,
  GapDetection,
  AuditLog,
  CompensationTask
};
