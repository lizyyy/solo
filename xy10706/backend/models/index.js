const sequelize = require('../config/database');
const Customer = require('./Customer');
const Package = require('./Package');
const ApiEndpoint = require('./ApiEndpoint');
const CallRecord = require('./CallRecord');
const ReviewRecord = require('./ReviewRecord');
const CustomerPackage = require('./CustomerPackage');

Customer.belongsToMany(Package, { through: CustomerPackage });
Package.belongsToMany(Customer, { through: CustomerPackage });

CallRecord.belongsTo(Customer);
CallRecord.belongsTo(ApiEndpoint);
CallRecord.belongsTo(CustomerPackage);

ReviewRecord.belongsTo(CallRecord);
ReviewRecord.belongsTo(Customer);

ApiEndpoint.belongsTo(Package);

module.exports = {
  sequelize,
  Customer,
  Package,
  ApiEndpoint,
  CallRecord,
  ReviewRecord,
  CustomerPackage
};
