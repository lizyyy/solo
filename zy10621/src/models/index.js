const sequelize = require('../config/database');
const Room = require('./Room');
const User = require('./User');
const CompensationRecord = require('./CompensationRecord');
const StatusHistory = require('./StatusHistory');

User.hasMany(CompensationRecord, { foreignKey: 'userId' });
CompensationRecord.belongsTo(User, { foreignKey: 'userId' });

Room.hasMany(CompensationRecord, { foreignKey: 'roomId' });
CompensationRecord.belongsTo(Room, { foreignKey: 'roomId' });

CompensationRecord.hasMany(StatusHistory, { foreignKey: 'recordId' });
StatusHistory.belongsTo(CompensationRecord, { foreignKey: 'recordId' });

User.hasMany(StatusHistory, { foreignKey: 'changedBy', as: 'statusChanges' });
StatusHistory.belongsTo(User, { foreignKey: 'changedBy', as: 'changer' });

module.exports = {
  sequelize,
  Room,
  User,
  CompensationRecord,
  StatusHistory
};
