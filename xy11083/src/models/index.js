const sequelize = require('../config/database');
const TestDrive = require('./TestDrive');
const AccidentRecord = require('./AccidentRecord');
const OperationLog = require('./OperationLog');

TestDrive.hasMany(AccidentRecord, { foreignKey: 'testDriveId' });
AccidentRecord.belongsTo(TestDrive, { foreignKey: 'testDriveId' });

AccidentRecord.hasMany(OperationLog, { foreignKey: 'accidentRecordId' });
OperationLog.belongsTo(AccidentRecord, { foreignKey: 'accidentRecordId' });

module.exports = {
  sequelize,
  TestDrive,
  AccidentRecord,
  OperationLog
};
