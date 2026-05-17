const STATUS = {
  AUTO_PROCESS: 'AUTO_PROCESS',
  PENDING_REVIEW: 'PENDING_REVIEW',
  TRANSFERRED_TO_HUMAN: 'TRANSFERRED_TO_HUMAN',
  CLOSED: 'CLOSED'
};

const STATUS_LABELS = {
  [STATUS.AUTO_PROCESS]: '自动处理',
  [STATUS.PENDING_REVIEW]: '待复核',
  [STATUS.TRANSFERRED_TO_HUMAN]: '已转人工',
  [STATUS.CLOSED]: '已关闭'
};

const EMOTIONS = ['positive', 'neutral', 'negative', 'angry'];

const VALID_QUEUES = ['general', 'billing', 'technical', 'complaint'];

const CONFLICT_THRESHOLD = 2;

module.exports = {
  STATUS,
  STATUS_LABELS,
  EMOTIONS,
  VALID_QUEUES,
  CONFLICT_THRESHOLD
};
