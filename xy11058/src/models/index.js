const sequelize = require('../config/database');
const TeamChangeApplication = require('./TeamChangeApplication');
const TeamChangeHistory = require('./TeamChangeHistory');
const InsuranceList = require('./InsuranceList');
const TeamMember = require('./TeamMember');

TeamChangeApplication.hasMany(TeamChangeHistory, {
  foreignKey: 'applicationId',
  as: 'history'
});

TeamChangeHistory.belongsTo(TeamChangeApplication, {
  foreignKey: 'applicationId',
  as: 'application'
});

module.exports = {
  sequelize,
  TeamChangeApplication,
  TeamChangeHistory,
  InsuranceList,
  TeamMember
};
