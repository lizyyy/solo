const sequelize = require('../config/database');

const Device = require('./Device');
const ScanRecord = require('./ScanRecord');
const PairingEvent = require('./PairingEvent');
const Zone = require('./Zone');
const Anomaly = require('./Anomaly');
const HandlingRecord = require('./HandlingRecord');

const models = {
  Device,
  ScanRecord,
  PairingEvent,
  Zone,
  Anomaly,
  HandlingRecord
};

Object.values(models).forEach(model => {
  if (model.associate) {
    model.associate(models);
  }
});

module.exports = {
  sequelize,
  ...models
};
