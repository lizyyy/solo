const sequelize = require('../config/database');
const RoadSection = require('./RoadSection');
const OccupationApplication = require('./OccupationApplication');
const ExtensionApplication = require('./ExtensionApplication');
const WithdrawalApplication = require('./WithdrawalApplication');
const FineRecord = require('./FineRecord');
const FineRule = require('./FineRule');
const BackgroundTask = require('./BackgroundTask');
const StatusAuditLog = require('./StatusAuditLog');

OccupationApplication.belongsTo(RoadSection, { foreignKey: 'roadSectionId', as: 'roadSection' });
RoadSection.hasMany(OccupationApplication, { foreignKey: 'roadSectionId', as: 'applications' });

ExtensionApplication.belongsTo(OccupationApplication, { foreignKey: 'occupationApplicationId', as: 'occupationApplication' });
OccupationApplication.hasMany(ExtensionApplication, { foreignKey: 'occupationApplicationId', as: 'extensions' });

WithdrawalApplication.belongsTo(OccupationApplication, { foreignKey: 'occupationApplicationId', as: 'occupationApplication' });
OccupationApplication.hasMany(WithdrawalApplication, { foreignKey: 'occupationApplicationId', as: 'withdrawals' });

FineRecord.belongsTo(OccupationApplication, { foreignKey: 'occupationApplicationId', as: 'occupationApplication' });
OccupationApplication.hasMany(FineRecord, { foreignKey: 'occupationApplicationId', as: 'fines' });

FineRecord.belongsTo(FineRule, { foreignKey: 'ruleId', as: 'fineRule' });
FineRule.hasMany(FineRecord, { foreignKey: 'ruleId', as: 'fines' });

module.exports = {
  sequelize,
  RoadSection,
  OccupationApplication,
  ExtensionApplication,
  WithdrawalApplication,
  FineRecord,
  FineRule,
  BackgroundTask,
  StatusAuditLog
};
