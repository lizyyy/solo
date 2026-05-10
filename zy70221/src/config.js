const path = require('path');

const DATA_DIR = process.env.VENDING_DATA_DIR || path.join(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'vending.db');
const EXPORTS_DIR = path.join(process.cwd(), 'exports');

const EXPIRY_THRESHOLD_DAYS = 7;
const CRITICAL_EXPIRY_DAYS = 3;

module.exports = {
  DATA_DIR,
  DB_PATH,
  EXPORTS_DIR,
  EXPIRY_THRESHOLD_DAYS,
  CRITICAL_EXPIRY_DAYS
};
