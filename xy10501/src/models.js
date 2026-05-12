const { v4: uuidv4 } = require('uuid');

const SUPPLIER_STATUS = {
  ACTIVE: 'ACTIVE',
  FROZEN: 'FROZEN'
};

const CERTIFICATE_STATUS = {
  VALID: 'VALID',
  EXPIRING_SOON: 'EXPIRING_SOON',
  EXPIRED: 'EXPIRED',
  PENDING_RENEWAL: 'PENDING_RENEWAL',
  INVALID: 'INVALID'
};

const PROJECT_ACCESS_STATUS = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  SUSPENDED: 'SUSPENDED',
  TERMINATED: 'TERMINATED'
};

const INSPECTION_STATUS = {
  PENDING: 'PENDING',
  IN_PROGRESS: 'IN_PROGRESS',
  PASSED: 'PASSED',
  FAILED: 'FAILED',
  MANUAL_REVIEW: 'MANUAL_REVIEW',
  COMPLETED: 'COMPLETED'
};

class DataStore {
  constructor() {
    this.suppliers = new Map();
    this.certificates = new Map();
    this.projects = new Map();
    this.projectAccesses = new Map();
    this.inspections = new Map();
    this.inspectionResults = new Map();
    this.freezeLogs = new Map();
    this.manualReviews = new Map();
    this.idempotencyKeys = new Map();
  }

  generateId() {
    return uuidv4();
  }
}

const store = new DataStore();

module.exports = {
  store,
  SUPPLIER_STATUS,
  CERTIFICATE_STATUS,
  PROJECT_ACCESS_STATUS,
  INSPECTION_STATUS
};
