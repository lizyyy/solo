const path = require('path');

const DEFAULT_DB_PATH = path.join(process.cwd(), '.market-settlement', 'settlement.db');
const DEFAULT_CONFIG_PATH = path.join(process.cwd(), '.market-settlement', 'config.json');

const DATA_TYPES = {
  VENDOR: 'vendor',
  BOOTH: 'booth',
  SALES: 'sales',
  DEPOSIT: 'deposit',
  ELECTRICITY: 'electricity',
  REFUND: 'refund',
  COMMISSION_RATE: 'commission_rate',
  PAYMENT: 'payment'
};

const SETTLEMENT_STATUS = {
  DRAFT: 'draft',
  PREVIEWED: 'previewed',
  CONFIRMED: 'confirmed',
  PAID: 'paid'
};

module.exports = {
  DEFAULT_DB_PATH,
  DEFAULT_CONFIG_PATH,
  DATA_TYPES,
  SETTLEMENT_STATUS
};
