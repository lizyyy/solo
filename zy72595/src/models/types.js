const { v4: uuidv4 } = require('uuid');

const BUCKET_NAMES = ['差', '较差', '一般', '良好', '优秀'];
const SCORE_BUCKETS = BUCKET_NAMES.length;

const EVAL_STATUS = {
  PENDING_REVIEW: 'pending_review',
  NORMAL: 'normal',
  ABNORMAL: 'abnormal',
  NEEDS_RECHECK: 'needs_recheck',
  ROLLBACK: 'rollback'
};

const WORKFLOW_STEP = {
  IMPORTED: 'imported',
  ONLINE_BUCKET_REVIEWED: 'online_bucket_reviewed',
  COMPARISON_UPDATED: 'comparison_updated'
};

const DISPLAY_MODE = {
  TABLE: 'table',
  CHART: 'chart',
  THREE_D: '3d'
};

function generateId() {
  return uuidv4();
}

function getBucketName(bucketIndex) {
  if (bucketIndex < 0 || bucketIndex >= SCORE_BUCKETS) {
    return null;
  }
  return BUCKET_NAMES[bucketIndex];
}

function getBucketIndex(bucketName) {
  const idx = BUCKET_NAMES.indexOf(bucketName);
  return idx === -1 ? null : idx;
}

module.exports = {
  BUCKET_NAMES,
  SCORE_BUCKETS,
  EVAL_STATUS,
  WORKFLOW_STEP,
  DISPLAY_MODE,
  generateId,
  getBucketName,
  getBucketIndex
};
