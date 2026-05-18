const path = require('path');

const CONFIG = {
  DEFAULT_INPUT_DIR: path.join(process.cwd(), 'samples'),
  DEFAULT_OUTPUT_DIR: path.join(process.cwd(), 'reports'),
  SUPPORTED_EXTENSIONS: ['.csv'],
  ENCODING: 'utf-8',
  
  PACKAGE_CONFIG: {
    DATA_LIMIT_GB: 100,
    VOICE_LIMIT_MINUTES: 1000,
    SMS_LIMIT_COUNT: 500,
    DATA_OVERAGE_RATE: 0.5,
    VOICE_OVERAGE_RATE: 0.15,
    SMS_OVERAGE_RATE: 0.1,
  },
  
  REPORT_FILES: {
    ISSUES: 'issues_detected.json',
    RESULTS: 'overage_results.json',
    SUMMARY: 'summary_report.md',
    HASH: '.processed_files_hash',
  },
  
  ISSUE_TYPES: {
    CROSS_MONTH_BACKFILL: '跨月补写',
    NEGATIVE_REVERSAL: '负数冲正',
    DUPLICATE_MEASUREMENT: '重复计量',
    MISSING_FIELDS: '缺失字段',
    INVALID_FORMAT: '格式无效',
    INVALID_NUMBER: '数值无效',
  },
};

module.exports = {
  CONFIG,
  ISSUE_TYPES: CONFIG.ISSUE_TYPES,
};

