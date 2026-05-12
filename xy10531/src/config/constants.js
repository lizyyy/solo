const ORDER_STATUS = {
  IMPORTED: 'imported',
  DOCS_PENDING: 'docs_pending',
  DOCS_VERIFIED: 'docs_verified',
  TAXCODE_PENDING: 'taxcode_pending',
  TAXCODE_VERIFIED: 'taxcode_verified',
  PRECHECK_PENDING: 'precheck_pending',
  PRECHECK_FAILED: 'precheck_failed',
  SUPPLEMENT_PENDING: 'supplement_pending',
  SUPPLEMENT_COMPLETED: 'supplement_completed',
  SUPPLEMENT_TIMEOUT: 'supplement_timeout',
  READY: 'ready',
  APPROVED: 'approved',
  SHIPPED: 'shipped',
  REJECTED: 'rejected'
};

const CHECKPOINT_TYPE = {
  DOCUMENT: 'document',
  TAXCODE: 'taxcode',
  PRECHECK: 'precheck',
  SUPPLEMENT: 'supplement',
  APPROVAL: 'approval',
  SHIPMENT: 'shipment'
};

const CHECKPOINT_STATUS = {
  PENDING: 'pending',
  PASSED: 'passed',
  FAILED: 'failed',
  SKIPPED: 'skipped'
};

const SUPPLEMENT_STATUS = {
  REQUESTED: 'requested',
  SUBMITTED: 'submitted',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  TIMEOUT: 'timeout'
};

const SUPPLEMENT_REASON = {
  MISSING_ID_PHOTO: 'missing_id_photo',
  ID_EXPIRED: 'id_expired',
  ID_NOT_MATCH: 'id_not_match',
  INVALID_TAXCODE: 'invalid_taxcode',
  TAXCODE_CATEGORY_MISMATCH: 'taxcode_category_mismatch',
  MISSING_COMMERCIAL_INVOICE: 'missing_commercial_invoice',
  MISSING_PACKING_LIST: 'missing_packing_list',
  OTHER: 'other'
};

const MAX_SUPPLEMENT_ATTEMPTS = 3;
const SUPPLEMENT_TIMEOUT_HOURS = 72;
const ORDER_STATUS_FLOW = [
  ORDER_STATUS.IMPORTED,
  ORDER_STATUS.DOCS_PENDING,
  ORDER_STATUS.DOCS_VERIFIED,
  ORDER_STATUS.TAXCODE_PENDING,
  ORDER_STATUS.TAXCODE_VERIFIED,
  ORDER_STATUS.PRECHECK_PENDING,
  ORDER_STATUS.SUPPLEMENT_PENDING,
  ORDER_STATUS.SUPPLEMENT_COMPLETED,
  ORDER_STATUS.READY,
  ORDER_STATUS.APPROVED,
  ORDER_STATUS.SHIPPED
];

module.exports = {
  ORDER_STATUS,
  CHECKPOINT_TYPE,
  CHECKPOINT_STATUS,
  SUPPLEMENT_STATUS,
  SUPPLEMENT_REASON,
  MAX_SUPPLEMENT_ATTEMPTS,
  SUPPLEMENT_TIMEOUT_HOURS,
  ORDER_STATUS_FLOW
};
