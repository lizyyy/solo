const SourceType = {
  SUPPLEMENT_EMAIL: 'supplement_email',
  REVIEW_DAILY: 'review_daily',
  CREDIT_LEDGER: 'credit_ledger'
};

const SourceTypeLabel = {
  [SourceType.SUPPLEMENT_EMAIL]: '补充邮件',
  [SourceType.REVIEW_DAILY]: '复核日报',
  [SourceType.CREDIT_LEDGER]: '授信台账'
};

const RecordStatus = {
  CONFIRMED: 'confirmed',
  PENDING_SUPPLEMENT: 'pending_supplement',
  MANUALLY_MODIFIED: 'manually_modified'
};

const RecordStatusLabel = {
  [RecordStatus.CONFIRMED]: '已确认',
  [RecordStatus.PENDING_SUPPLEMENT]: '待补材料',
  [RecordStatus.MANUALLY_MODIFIED]: '人工修改'
};

const OperationType = {
  MATERIAL_SUPPLEMENT: 'material_supplement',
  CONCLUSION_CHANGE: 'conclusion_change'
};

const OperationTypeLabel = {
  [OperationType.MATERIAL_SUPPLEMENT]: '补充材料',
  [OperationType.CONCLUSION_CHANGE]: '修改结论'
};

module.exports = {
  SourceType,
  SourceTypeLabel,
  RecordStatus,
  RecordStatusLabel,
  OperationType,
  OperationTypeLabel
};
