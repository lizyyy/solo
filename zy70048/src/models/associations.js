const LineStop = require('./LineStop');
const StopReason = require('./StopReason');
const Responsibility = require('./Responsibility');
const RecoveryRecord = require('./RecoveryRecord');
const ReviewReport = require('./ReviewReport');
const StatusHistory = require('./StatusHistory');

const setupAssociations = () => {
  LineStop.hasMany(StopReason, {
    foreignKey: 'lineStopId',
    as: 'stopReasons',
    onDelete: 'CASCADE'
  });
  StopReason.belongsTo(LineStop, {
    foreignKey: 'lineStopId',
    as: 'lineStop'
  });

  LineStop.hasMany(Responsibility, {
    foreignKey: 'lineStopId',
    as: 'responsibilities',
    onDelete: 'CASCADE'
  });
  Responsibility.belongsTo(LineStop, {
    foreignKey: 'lineStopId',
    as: 'lineStop'
  });

  LineStop.hasMany(RecoveryRecord, {
    foreignKey: 'lineStopId',
    as: 'recoveryRecords',
    onDelete: 'CASCADE'
  });
  RecoveryRecord.belongsTo(LineStop, {
    foreignKey: 'lineStopId',
    as: 'lineStop'
  });

  LineStop.hasMany(ReviewReport, {
    foreignKey: 'lineStopId',
    as: 'reviewReports',
    onDelete: 'CASCADE'
  });
  ReviewReport.belongsTo(LineStop, {
    foreignKey: 'lineStopId',
    as: 'lineStop'
  });

  LineStop.hasMany(StatusHistory, {
    foreignKey: 'lineStopId',
    as: 'statusHistories',
    onDelete: 'CASCADE'
  });
  StatusHistory.belongsTo(LineStop, {
    foreignKey: 'lineStopId',
    as: 'lineStop'
  });
};

module.exports = setupAssociations;
