const sequelize = require('../config/database');
const Order = require('./Order');
const Refund = require('./Refund');
const AuditLog = require('./AuditLog');
const Task = require('./Task');

Order.hasMany(Refund, { foreignKey: 'orderId', as: 'refunds' });
Refund.belongsTo(Order, { foreignKey: 'orderId', as: 'order' });

Refund.hasMany(AuditLog, {
  foreignKey: 'entityId',
  constraints: false,
  scope: {
    entityType: 'Refund'
  },
  as: 'auditLogs'
});

Order.hasMany(AuditLog, {
  foreignKey: 'entityId',
  constraints: false,
  scope: {
    entityType: 'Order'
  },
  as: 'auditLogs'
});

module.exports = {
  sequelize,
  Order,
  Refund,
  AuditLog,
  Task
};