const sequelize = require('../config/database');
const Key = require('./Key');
const Order = require('./Order');
const ExchangeRecord = require('./ExchangeRecord');
const AuditLog = require('./AuditLog');

Key.hasMany(ExchangeRecord, { foreignKey: 'keyId' });
ExchangeRecord.belongsTo(Key, { foreignKey: 'keyId' });

Order.hasMany(ExchangeRecord, { foreignKey: 'orderId' });
ExchangeRecord.belongsTo(Order, { foreignKey: 'orderId' });

module.exports = {
  sequelize,
  Key,
  Order,
  ExchangeRecord,
  AuditLog,
};
