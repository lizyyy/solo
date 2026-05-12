const { sequelize } = require('../config/database');

const MeetingRoom = require('./MeetingRoom');
const Equipment = require('./Equipment');
const Booking = require('./Booking');
const Inspection = require('./Inspection');
const DamageReport = require('./DamageReport');
const LiabilityConfirmation = require('./LiabilityConfirmation');
const Compensation = require('./Compensation');
const ActionHistory = require('./ActionHistory');

MeetingRoom.hasMany(Equipment, { foreignKey: 'meetingRoomId' });
Equipment.belongsTo(MeetingRoom, { foreignKey: 'meetingRoomId' });

MeetingRoom.hasMany(Booking, { foreignKey: 'meetingRoomId' });
Booking.belongsTo(MeetingRoom, { foreignKey: 'meetingRoomId' });

Booking.hasMany(Inspection, { foreignKey: 'bookingId' });
Inspection.belongsTo(Booking, { foreignKey: 'bookingId' });

Equipment.hasMany(DamageReport, { foreignKey: 'equipmentId' });
DamageReport.belongsTo(Equipment, { foreignKey: 'equipmentId' });

Booking.hasMany(DamageReport, { foreignKey: 'bookingId' });
DamageReport.belongsTo(Booking, { foreignKey: 'bookingId' });

Inspection.hasMany(DamageReport, { foreignKey: 'inspectionId' });
DamageReport.belongsTo(Inspection, { foreignKey: 'inspectionId' });

DamageReport.hasMany(LiabilityConfirmation, { foreignKey: 'damageReportId' });
LiabilityConfirmation.belongsTo(DamageReport, { foreignKey: 'damageReportId' });

Booking.hasMany(LiabilityConfirmation, { foreignKey: 'bookingId' });
LiabilityConfirmation.belongsTo(Booking, { foreignKey: 'bookingId' });

LiabilityConfirmation.hasMany(Compensation, { foreignKey: 'liabilityConfirmationId' });
Compensation.belongsTo(LiabilityConfirmation, { foreignKey: 'liabilityConfirmationId' });

DamageReport.hasMany(Compensation, { foreignKey: 'damageReportId' });
Compensation.belongsTo(DamageReport, { foreignKey: 'damageReportId' });

DamageReport.hasMany(DamageReport, { foreignKey: 'parentReportId', as: 'DuplicateReports' });
DamageReport.belongsTo(DamageReport, { foreignKey: 'parentReportId', as: 'ParentReport' });

module.exports = {
  sequelize,
  MeetingRoom,
  Equipment,
  Booking,
  Inspection,
  DamageReport,
  LiabilityConfirmation,
  Compensation,
  ActionHistory
};
