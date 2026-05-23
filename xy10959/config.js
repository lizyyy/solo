const DEFAULT_CHANNEL_PRIORITY = {
  '展会': 1,
  '表单': 2,
  '电话': 3,
  'default': 99
};

const DEFAULT_FUZZY_OPTIONS = {
  company: {
    threshold: 0.85,
    keys: ['companyName']
  },
  email: {
    threshold: 0.9,
    keys: ['email']
  }
};

const REQUIRED_FIELDS = ['手机号', '邮箱', '公司名', '来源渠道'];

const OUTPUT_FILES = {
  json: 'deduplication-results.json',
  markdown: 'deduplication-report.md',
  cleaned: 'cleaned-leads.csv',
  duplicates: 'duplicate-groups.csv',
  errors: 'error-rows.csv'
};

module.exports = {
  DEFAULT_CHANNEL_PRIORITY,
  DEFAULT_FUZZY_OPTIONS,
  REQUIRED_FIELDS,
  OUTPUT_FILES
};
