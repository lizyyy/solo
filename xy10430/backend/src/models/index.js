const { sequelize, Op } = require('../config/database');
const CargoType = require('./CargoType');
const Shipment = require('./Shipment');
const TemperatureRecord = require('./TemperatureRecord');
const TransportNode = require('./TransportNode');
const SignOff = require('./SignOff');
const Claim = require('./Claim');
const ClaimApproval = require('./ClaimApproval');

module.exports = {
  sequelize,
  Op,
  CargoType,
  Shipment,
  TemperatureRecord,
  TransportNode,
  SignOff,
  Claim,
  ClaimApproval
};
