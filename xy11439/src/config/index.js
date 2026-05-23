const path = require('path');

module.exports = {
  port: process.env.PORT || 3000,
  db: {
    path: path.join(process.cwd(), 'data', 'ledger.db'),
  },
  roles: {
    ADMIN: 'admin',
    MANAGER: 'manager',
    SUPERVISOR: 'supervisor',
    STAFF: 'staff',
    AUDITOR: 'auditor',
  },
  workflow: {
    DRAFT: 'draft',
    SUBMITTED: 'submitted',
    REJECTED: 'rejected',
    CONFIRMED: 'confirmed',
    AUDITED: 'audited',
  },
  taskStatus: {
    PENDING: 'pending',
    PROCESSING: 'processing',
    RETRY: 'retry',
    MANUAL: 'manual',
    FAILED: 'failed',
    COMPLETED: 'completed',
  },
  mergeStrategy: {
    IGNORE: 'ignore',
    OVERWRITE: 'overwrite',
    APPEND: 'append',
  },
  sensitiveFields: ['guestPhone', 'guestName', 'guestIdCard', 'roomPassword'],
};
