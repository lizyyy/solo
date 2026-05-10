const path = require('path');

module.exports = {
  port: process.env.PORT || 3000,
  db: {
    path: process.env.DB_PATH || path.join(__dirname, '../../data/app.db')
  },
  status: {
    DRAFT: 'draft',
    PENDING_REVIEW: 'pending_review',
    REVIEW_APPROVED: 'review_approved',
    REVIEW_REJECTED: 'review_rejected',
    EXECUTING: 'executing',
    EXECUTION_SUCCESS: 'execution_success',
    EXECUTION_FAILED: 'execution_failed',
    ROLLBACK_REQUESTED: 'rollback_requested',
    ROLLBACK_EXECUTING: 'rollback_executing',
    ROLLBACK_SUCCESS: 'rollback_success',
    ROLLBACK_FAILED: 'rollback_failed',
    CLOSED: 'closed',
    CANCELLED: 'cancelled'
  }
};