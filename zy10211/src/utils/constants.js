const path = require('path');

const DATA_DIR = path.join(process.cwd(), 'data');
const PENDING_DIR = path.join(DATA_DIR, 'pending');
const CONFIRMED_DIR = path.join(DATA_DIR, 'confirmed');
const DEFAULT_CUTOFF_TIME = '10:00';

module.exports = {
  DATA_DIR,
  PENDING_DIR,
  CONFIRMED_DIR,
  DEFAULT_CUTOFF_TIME
};
