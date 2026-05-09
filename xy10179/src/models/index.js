const sequelize = require('../config/database');

const Tenant = require('./Tenant');
const User = require('./User');
const DataRecord = require('./DataRecord');
const AuditLog = require('./AuditLog');
const SecurityIncident = require('./SecurityIncident');

module.exports = {
  sequelize,
  Tenant,
  User,
  DataRecord,
  AuditLog,
  SecurityIncident
};
