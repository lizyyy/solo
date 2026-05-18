const sequelize = require('../config/database');
const Receivable = require('./Receivable');
const ReceivableHistory = require('./ReceivableHistory');
const FinanceOrder = require('./FinanceOrder');
const ImportLog = require('./ImportLog');

Receivable.hasMany(ReceivableHistory, { foreignKey: 'receivableId', as: 'histories' });
ReceivableHistory.belongsTo(Receivable, { foreignKey: 'receivableId' });

Receivable.belongsTo(FinanceOrder, { foreignKey: 'financeOrderId', as: 'financeOrder' });
FinanceOrder.hasMany(Receivable, { foreignKey: 'financeOrderId', as: 'receivables' });

module.exports = {
  sequelize,
  Receivable,
  ReceivableHistory,
  FinanceOrder,
  ImportLog
};