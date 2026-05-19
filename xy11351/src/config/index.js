module.exports = {
  database: require('./database'),
  STATUS: {
    PENDING: 'pending',
    CHECKED: 'checked',
    APPROVED: 'approved',
    REJECTED: 'rejected',
    REWORKED: 'reworked'
  },
  QUALITY_LEVEL: {
    EXCELLENT: 'excellent',
    GOOD: 'good',
    ACCEPTABLE: 'acceptable',
    UNACCEPTABLE: 'unacceptable'
  },
  LAB_TOLERANCE: {
    L: 2.0,
    A: 2.0,
    B: 2.0
  }
};
