const { v4: uuidv4 } = require('uuid');

const store = {
  cards: [],
  plateBindings: [],
  transactions: [],
  gateSync: [],
  anomalies: [],
  operationLogs: [],
  idempotency: {},
  gateStatus: {}
};

const enums = {
  CardStatus: {
    DRAFT: 'draft',
    ACTIVE: 'active',
    PAUSED: 'paused',
    SUSPENDED: 'suspended',
    EXPIRED: 'expired',
    CANCELLED: 'cancelled'
  },
  PlateBindingStatus: {
    ACTIVE: 'active',
    HISTORICAL: 'historical'
  },
  TransactionType: {
    RENEWAL: 'renewal',
    OPEN_ACCOUNT: 'open_account',
    REFUND: 'refund'
  },
  TransactionStatus: {
    PENDING: 'pending',
    SUCCESS: 'success',
    FAILED: 'failed'
  },
  SyncStatus: {
    PENDING: 'pending',
    SUCCESS: 'success',
    FAILED: 'failed',
    RETRYING: 'retrying'
  },
  AnomalyType: {
    PLATE_CONFLICT: 'plate_conflict',
    SYNC_FAILED: 'sync_failed',
    PAYMENT_EXCEPTION: 'payment_exception',
    ACCESS_DENIED: 'access_denied'
  }
};

const generateId = () => uuidv4();
const now = () => new Date().toISOString();

module.exports = { store, enums, generateId, now };
