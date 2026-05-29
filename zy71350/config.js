const path = require('path');

module.exports = {
  PORT: process.env.PORT || 3000,
  DB_PATH: path.join(__dirname, 'data', 'gallery.db'),
  UPLOAD_DIR: path.join(__dirname, 'uploads'),
  EXPORT_DIR: path.join(__dirname, 'exports'),
  
  COMMISSION_RATES: {
    DEFAULT: 0.30,
    EMERGING: 0.25,
    ESTABLISHED: 0.35,
    MASTER: 0.40
  },
  
  DISCOUNT_AUTH_THRESHOLD: 0.10,
  
  EXHIBITION_MONTH_THRESHOLD: 7,
  
  SEVERITY: {
    CRITICAL: 'critical',
    WARNING: 'warning',
    INFO: 'info'
  },
  
  STATUS: {
    IMPORTED: 'imported',
    VALIDATING: 'validating',
    PENDING_REVIEW: 'pending_review',
    AUTHORIZED: 'authorized',
    SETTLED: 'settled',
    REJECTED: 'rejected'
  }
};
