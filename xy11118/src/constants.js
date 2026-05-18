const EXIT_CODES = {
  SUCCESS: 0,
  ERROR_INVALID_ARGS: 1,
  ERROR_CONFIG_NOT_FOUND: 2,
  ERROR_INPUT_NOT_FOUND: 3,
  ERROR_INVALID_CSV: 4,
  ERROR_PROCESSING_FAILED: 5,
  ERROR_OUTPUT_FAILED: 6,
  WARNING_HAS_SPECIAL_CASES: 10
};

const RECORD_TYPES = {
  NORMAL: 'normal',
  CROSS_MONTH_REFUND: 'cross_month_refund',
  RESIGNED_EMPLOYEE: 'resigned_employee',
  RERUN_OUTPUT: 'rerun_output'
};

const AUDIT_ACTIONS = {
  PROCESS_START: 'process_start',
  PROCESS_END: 'process_end',
  RECORD_CLASSIFIED: 'record_classified',
  RULE_APPLIED: 'rule_applied',
  SPECIAL_CASE_DETECTED: 'special_case_detected',
  OUTPUT_GENERATED: 'output_generated'
};

module.exports = {
  EXIT_CODES,
  RECORD_TYPES,
  AUDIT_ACTIONS
};
