const sequelize = require('../config/database');

const WaterSample = require('./WaterSample');
const Risk = require('./Risk');
const ReviewRecord = require('./ReviewRecord');
const DisposalRecord = require('./DisposalRecord');

Risk.hasMany(ReviewRecord, { foreignKey: 'risk_id', as: 'reviews' });
Risk.hasMany(DisposalRecord, { foreignKey: 'risk_id', as: 'disposals' });

ReviewRecord.belongsTo(Risk, { foreignKey: 'risk_id' });
DisposalRecord.belongsTo(Risk, { foreignKey: 'risk_id' });

module.exports = {
  sequelize,
  WaterSample,
  Risk,
  ReviewRecord,
  DisposalRecord
};
