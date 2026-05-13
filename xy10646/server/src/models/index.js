const sequelize = require('../config/database');
const SamplingPoint = require('./SamplingPoint');
const SampleBottle = require('./SampleBottle');
const TestItem = require('./TestItem');
const SampleRecord = require('./SampleRecord');
const FlowRecord = require('./FlowRecord');
const AuditLog = require('./AuditLog');

SamplingPoint.hasMany(SampleRecord, { foreignKey: 'samplingPointId' });
SampleRecord.belongsTo(SamplingPoint, { foreignKey: 'samplingPointId' });

SampleBottle.hasMany(SampleRecord, { foreignKey: 'bottleId' });
SampleRecord.belongsTo(SampleBottle, { foreignKey: 'bottleId' });

SampleRecord.hasMany(FlowRecord, { foreignKey: 'sampleRecordId' });
FlowRecord.belongsTo(SampleRecord, { foreignKey: 'sampleRecordId' });

SampleRecord.hasMany(TestItem, { foreignKey: 'sampleRecordId' });
TestItem.belongsTo(SampleRecord, { foreignKey: 'sampleRecordId' });

module.exports = {
  sequelize,
  SamplingPoint,
  SampleBottle,
  TestItem,
  SampleRecord,
  FlowRecord,
  AuditLog
};
