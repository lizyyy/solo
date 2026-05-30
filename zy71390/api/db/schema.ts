export const CREATE_TABLE_RULES = `
CREATE TABLE IF NOT EXISTS rules (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  path TEXT NOT NULL,
  method TEXT NOT NULL CHECK(method IN ('GET', 'POST', 'PUT', 'DELETE', '*')),
  windowSize INTEGER NOT NULL,
  "limit" INTEGER NOT NULL,
  tier TEXT NOT NULL CHECK(tier IN ('S', 'A', 'B', 'C')),
  status TEXT NOT NULL CHECK(status IN ('active', 'draft', 'deprecated')),
  currentVersion INTEGER NOT NULL DEFAULT 1,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);
`;

export const CREATE_TABLE_HIT_RESULTS = `
CREATE TABLE IF NOT EXISTS hit_results (
  id TEXT PRIMARY KEY,
  reportId TEXT NOT NULL,
  requestId TEXT NOT NULL,
  ruleId TEXT NOT NULL,
  ruleVersion INTEGER NOT NULL,
  customerId TEXT NOT NULL,
  customerName TEXT NOT NULL,
  customerTier TEXT NOT NULL CHECK(customerTier IN ('S', 'A', 'B', 'C')),
  hitReason TEXT NOT NULL CHECK(hitReason IN ('threshold_exceeded', 'whitelist_expired', 'window_overlap', 'false_positive')),
  explanation TEXT NOT NULL,
  wouldBlock INTEGER NOT NULL DEFAULT 0,
  confidence REAL NOT NULL,
  requestTimestamp TEXT NOT NULL,
  requestPath TEXT NOT NULL,
  rawRequest TEXT
);
`;

export const CREATE_TABLE_ANOMALIES = `
CREATE TABLE IF NOT EXISTS anomalies (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK(type IN ('whitelist_expired', 'window_overlap', 'false_positive')),
  severity TEXT NOT NULL CHECK(severity IN ('critical', 'warning', 'info')),
  message TEXT NOT NULL,
  affectedEntities TEXT NOT NULL,
  recommendation TEXT NOT NULL,
  resolved INTEGER NOT NULL DEFAULT 0,
  resolution TEXT,
  createdAt TEXT NOT NULL
);
`;

export const CREATE_TABLE_RULE_VERSIONS = `
CREATE TABLE IF NOT EXISTS rule_versions (
  id TEXT PRIMARY KEY,
  ruleId TEXT NOT NULL,
  version INTEGER NOT NULL,
  snapshot TEXT NOT NULL,
  changeReason TEXT NOT NULL,
  modifiedBy TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  FOREIGN KEY (ruleId) REFERENCES rules(id) ON DELETE CASCADE
);
`;

export const CREATE_TABLE_CUSTOMERS = `
CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  tier TEXT NOT NULL CHECK(tier IN ('S', 'A', 'B', 'C')),
  priority INTEGER NOT NULL,
  isWhitelisted INTEGER NOT NULL DEFAULT 0,
  whitelistExpiresAt TEXT,
  whitelistReason TEXT,
  totalRequests INTEGER NOT NULL DEFAULT 0,
  blockedCount INTEGER NOT NULL DEFAULT 0,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);
`;

export const CREATE_TABLE_WHITELIST = `
CREATE TABLE IF NOT EXISTS whitelist (
  id TEXT PRIMARY KEY,
  customerId TEXT NOT NULL,
  customerName TEXT NOT NULL,
  reason TEXT NOT NULL,
  expiresAt TEXT NOT NULL,
  createdBy TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  FOREIGN KEY (customerId) REFERENCES customers(id) ON DELETE CASCADE
);
`;

export const CREATE_TABLE_REQUEST_LOGS = `
CREATE TABLE IF NOT EXISTS request_logs (
  id TEXT PRIMARY KEY,
  customerId TEXT NOT NULL,
  path TEXT NOT NULL,
  method TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  statusCode INTEGER NOT NULL,
  latency INTEGER NOT NULL,
  userAgent TEXT NOT NULL,
  ip TEXT NOT NULL,
  FOREIGN KEY (customerId) REFERENCES customers(id) ON DELETE CASCADE
);
`;

export const CREATE_TABLE_DRILL_REPORTS = `
CREATE TABLE IF NOT EXISTS drill_reports (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  ruleId TEXT NOT NULL,
  ruleName TEXT NOT NULL,
  ruleVersion INTEGER NOT NULL,
  startTime TEXT NOT NULL,
  endTime TEXT NOT NULL,
  sampleRate REAL NOT NULL,
  totalRequests INTEGER NOT NULL,
  hitCount INTEGER NOT NULL,
  blockedCustomers TEXT NOT NULL,
  anomalies TEXT NOT NULL,
  hitResults TEXT NOT NULL,
  conclusion TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('pending', 'running', 'completed', 'failed')),
  createdAt TEXT NOT NULL
);
`;

export const CREATE_TABLE_MODIFICATION_LOGS = `
CREATE TABLE IF NOT EXISTS modification_logs (
  id TEXT PRIMARY KEY,
  entityType TEXT NOT NULL CHECK(entityType IN ('rule', 'customer', 'whitelist')),
  entityId TEXT NOT NULL,
  field TEXT NOT NULL,
  oldValue TEXT NOT NULL,
  newValue TEXT NOT NULL,
  reason TEXT NOT NULL,
  modifiedBy TEXT NOT NULL,
  createdAt TEXT NOT NULL
);
`;

export const CREATE_INDEX_RULES_TIER = `
CREATE INDEX IF NOT EXISTS idx_rules_tier ON rules(tier);
`;

export const CREATE_INDEX_RULES_STATUS = `
CREATE INDEX IF NOT EXISTS idx_rules_status ON rules(status);
`;

export const CREATE_INDEX_HIT_RESULTS_REPORT_ID = `
CREATE INDEX IF NOT EXISTS idx_hit_results_reportId ON hit_results(reportId);
`;

export const CREATE_INDEX_HIT_RESULTS_RULE_ID = `
CREATE INDEX IF NOT EXISTS idx_hit_results_ruleId ON hit_results(ruleId);
`;

export const CREATE_INDEX_HIT_RESULTS_CUSTOMER_ID = `
CREATE INDEX IF NOT EXISTS idx_hit_results_customerId ON hit_results(customerId);
`;

export const CREATE_INDEX_HIT_RESULTS_TIMESTAMP = `
CREATE INDEX IF NOT EXISTS idx_hit_results_timestamp ON hit_results(requestTimestamp);
`;

export const CREATE_INDEX_ANOMALIES_TYPE = `
CREATE INDEX IF NOT EXISTS idx_anomalies_type ON anomalies(type);
`;

export const CREATE_INDEX_ANOMALIES_SEVERITY = `
CREATE INDEX IF NOT EXISTS idx_anomalies_severity ON anomalies(severity);
`;

export const CREATE_INDEX_ANOMALIES_RESOLVED = `
CREATE INDEX IF NOT EXISTS idx_anomalies_resolved ON anomalies(resolved);
`;

export const CREATE_INDEX_RULE_VERSIONS_RULE_ID = `
CREATE INDEX IF NOT EXISTS idx_rule_versions_ruleId ON rule_versions(ruleId);
`;

export const CREATE_INDEX_CUSTOMERS_TIER = `
CREATE INDEX IF NOT EXISTS idx_customers_tier ON customers(tier);
`;

export const CREATE_INDEX_WHITELIST_CUSTOMER_ID = `
CREATE INDEX IF NOT EXISTS idx_whitelist_customerId ON whitelist(customerId);
`;

export const CREATE_INDEX_WHITELIST_EXPIRES_AT = `
CREATE INDEX IF NOT EXISTS idx_whitelist_expiresAt ON whitelist(expiresAt);
`;

export const CREATE_INDEX_REQUEST_LOGS_CUSTOMER_ID = `
CREATE INDEX IF NOT EXISTS idx_request_logs_customerId ON request_logs(customerId);
`;

export const CREATE_INDEX_REQUEST_LOGS_TIMESTAMP = `
CREATE INDEX IF NOT EXISTS idx_request_logs_timestamp ON request_logs(timestamp);
`;

export const CREATE_INDEX_REQUEST_LOGS_PATH = `
CREATE INDEX IF NOT EXISTS idx_request_logs_path ON request_logs(path);
`;

export const CREATE_INDEX_DRILL_REPORTS_RULE_ID = `
CREATE INDEX IF NOT EXISTS idx_drill_reports_ruleId ON drill_reports(ruleId);
`;

export const CREATE_INDEX_DRILL_REPORTS_STATUS = `
CREATE INDEX IF NOT EXISTS idx_drill_reports_status ON drill_reports(status);
`;

export const CREATE_INDEX_MODIFICATION_LOGS_ENTITY = `
CREATE INDEX IF NOT EXISTS idx_modification_logs_entity ON modification_logs(entityType, entityId);
`;

export const CREATE_INDEX_MODIFICATION_LOGS_CREATED_AT = `
CREATE INDEX IF NOT EXISTS idx_modification_logs_createdAt ON modification_logs(createdAt);
`;

export const ALL_DDL_STATEMENTS = [
  CREATE_TABLE_RULES,
  CREATE_TABLE_RULE_VERSIONS,
  CREATE_TABLE_CUSTOMERS,
  CREATE_TABLE_WHITELIST,
  CREATE_TABLE_REQUEST_LOGS,
  CREATE_TABLE_DRILL_REPORTS,
  CREATE_TABLE_MODIFICATION_LOGS,
  CREATE_TABLE_HIT_RESULTS,
  CREATE_TABLE_ANOMALIES,
  CREATE_INDEX_RULES_TIER,
  CREATE_INDEX_RULES_STATUS,
  CREATE_INDEX_RULE_VERSIONS_RULE_ID,
  CREATE_INDEX_CUSTOMERS_TIER,
  CREATE_INDEX_WHITELIST_CUSTOMER_ID,
  CREATE_INDEX_WHITELIST_EXPIRES_AT,
  CREATE_INDEX_REQUEST_LOGS_CUSTOMER_ID,
  CREATE_INDEX_REQUEST_LOGS_TIMESTAMP,
  CREATE_INDEX_REQUEST_LOGS_PATH,
  CREATE_INDEX_DRILL_REPORTS_RULE_ID,
  CREATE_INDEX_DRILL_REPORTS_STATUS,
  CREATE_INDEX_MODIFICATION_LOGS_ENTITY,
  CREATE_INDEX_MODIFICATION_LOGS_CREATED_AT,
  CREATE_INDEX_HIT_RESULTS_REPORT_ID,
  CREATE_INDEX_HIT_RESULTS_RULE_ID,
  CREATE_INDEX_HIT_RESULTS_CUSTOMER_ID,
  CREATE_INDEX_HIT_RESULTS_TIMESTAMP,
  CREATE_INDEX_ANOMALIES_TYPE,
  CREATE_INDEX_ANOMALIES_SEVERITY,
  CREATE_INDEX_ANOMALIES_RESOLVED,
];
