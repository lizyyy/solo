const sequelize = require('../config/database');
const Claim = require('./Claim');
const ClaimVersion = require('./ClaimVersion');
const AuditLog = require('./AuditLog');

Claim.hasMany(ClaimVersion, { foreignKey: 'claimId', as: 'versions' });
ClaimVersion.belongsTo(Claim, { foreignKey: 'claimId' });

Claim.hasMany(AuditLog, { foreignKey: 'claimId', as: 'logs' });
AuditLog.belongsTo(Claim, { foreignKey: 'claimId' });

module.exports = {
  sequelize,
  Claim,
  ClaimVersion,
  AuditLog
};
