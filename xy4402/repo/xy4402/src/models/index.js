const sequelize = require('../config/database');

const Store = require('./store');
const Vehicle = require('./vehicle');
const Batch = require('./batch');
const Waybill = require('./waybill');
const WeighingRecord = require('./weighingRecord');
const GPSTrack = require('./gpsTrack');
const Review = require('./review');
const RiskRecord = require('./riskRecord');

const syncDatabase = async (force = false) => {
  try {
    await sequelize.authenticate();
    console.log('数据库连接成功');
    await sequelize.sync({ force });
    console.log('数据库同步完成');
  } catch (error) {
    console.error('数据库连接失败:', error);
    throw error;
  }
};

module.exports = {
  sequelize,
  syncDatabase,
  Store,
  Vehicle,
  Batch,
  Waybill,
  WeighingRecord,
  GPSTrack,
  Review,
  RiskRecord
};
