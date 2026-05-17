const sequelize = require('../config/database');

const Customer = require('./Customer');
const WhitelistType = require('./WhitelistType');
const WhitelistRule = require('./WhitelistRule');
const ApplicationSource = require('./ApplicationSource');
const CustomerWhitelist = require('./CustomerWhitelist');
const HitRecord = require('./HitRecord');
const ExplanationReport = require('./ExplanationReport');
const ExceptionLog = require('./ExceptionLog');

CustomerWhitelist.belongsTo(Customer, { foreignKey: 'customerId', as: 'customer' });
CustomerWhitelist.belongsTo(WhitelistType, { foreignKey: 'whitelistTypeId', as: 'whitelistType' });
CustomerWhitelist.belongsTo(WhitelistRule, { foreignKey: 'whitelistRuleId', as: 'whitelistRule' });
CustomerWhitelist.belongsTo(ApplicationSource, { foreignKey: 'applicationSourceId', as: 'applicationSource' });

WhitelistRule.belongsTo(WhitelistType, { foreignKey: 'whitelistTypeId', as: 'whitelistType' });

HitRecord.belongsTo(CustomerWhitelist, { foreignKey: 'customerWhitelistId', as: 'customerWhitelist' });
HitRecord.belongsTo(Customer, { foreignKey: 'customerId', as: 'customer' });

ExplanationReport.belongsTo(Customer, { foreignKey: 'customerId', as: 'customer' });
ExplanationReport.belongsTo(CustomerWhitelist, { foreignKey: 'customerWhitelistId', as: 'customerWhitelist' });
ExplanationReport.belongsTo(HitRecord, { foreignKey: 'hitRecordId', as: 'hitRecord' });

Customer.hasMany(CustomerWhitelist, { foreignKey: 'customerId', as: 'whitelists' });
Customer.hasMany(HitRecord, { foreignKey: 'customerId', as: 'hitRecords' });
Customer.hasMany(ExplanationReport, { foreignKey: 'customerId', as: 'reports' });

WhitelistType.hasMany(WhitelistRule, { foreignKey: 'whitelistTypeId', as: 'rules' });
WhitelistType.hasMany(CustomerWhitelist, { foreignKey: 'whitelistTypeId', as: 'customerWhitelists' });

WhitelistRule.hasMany(CustomerWhitelist, { foreignKey: 'whitelistRuleId', as: 'customerWhitelists' });

ApplicationSource.hasMany(CustomerWhitelist, { foreignKey: 'applicationSourceId', as: 'customerWhitelists' });

CustomerWhitelist.hasMany(HitRecord, { foreignKey: 'customerWhitelistId', as: 'hitRecords' });
CustomerWhitelist.hasMany(ExplanationReport, { foreignKey: 'customerWhitelistId', as: 'reports' });

HitRecord.hasMany(ExplanationReport, { foreignKey: 'hitRecordId', as: 'reports' });

module.exports = {
  sequelize,
  Customer,
  WhitelistType,
  WhitelistRule,
  ApplicationSource,
  CustomerWhitelist,
  HitRecord,
  ExplanationReport,
  ExceptionLog
};
