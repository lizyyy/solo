const sequelize = require('../database');
const Room = require('./Room');
const Device = require('./Device');
const Interpreter = require('./Interpreter');
const Conference = require('./Conference');
const LanguageChannel = require('./LanguageChannel');
const Schedule = require('./Schedule');

Room.hasMany(Device, { foreignKey: 'roomId', as: 'devices' });
Device.belongsTo(Room, { foreignKey: 'roomId', as: 'room' });

Room.hasMany(Conference, { foreignKey: 'roomId', as: 'conferences' });
Conference.belongsTo(Room, { foreignKey: 'roomId', as: 'room' });

Conference.hasMany(LanguageChannel, { foreignKey: 'conferenceId', as: 'channels' });
LanguageChannel.belongsTo(Conference, { foreignKey: 'conferenceId', as: 'conference' });

Conference.hasMany(Schedule, { foreignKey: 'conferenceId', as: 'schedules' });
Schedule.belongsTo(Conference, { foreignKey: 'conferenceId', as: 'conference' });

LanguageChannel.hasMany(Schedule, { foreignKey: 'channelId', as: 'schedules' });
Schedule.belongsTo(LanguageChannel, { foreignKey: 'channelId', as: 'channel' });

Interpreter.hasMany(Schedule, { foreignKey: 'interpreterId', as: 'schedules' });
Schedule.belongsTo(Interpreter, { foreignKey: 'interpreterId', as: 'interpreter' });

Device.hasMany(Schedule, { foreignKey: 'deviceId', as: 'schedules' });
Schedule.belongsTo(Device, { foreignKey: 'deviceId', as: 'device' });

module.exports = {
  sequelize,
  Room,
  Device,
  Interpreter,
  Conference,
  LanguageChannel,
  Schedule
};
