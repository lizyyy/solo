const { v4: uuidv4 } = require('uuid');
const moment = require('moment');

let store = {
  deletion_requests: [],
  scan_results: [],
  deletion_executions: [],
  deletion_certificates: [],
  mock_user_profiles: [],
  mock_orders: [],
  mock_support_tickets: [],
  mock_marketing_records: [],
  mock_log_indexes: []
};

const tables = {
  deletion_requests: {
    id: 'TEXT',
    customer_id: 'TEXT',
    customer_name: 'TEXT',
    customer_email: 'TEXT',
    identity_verified: 'INTEGER',
    status: 'TEXT',
    request_type: 'TEXT',
    data_scope: 'TEXT',
    requested_at: 'TEXT',
    completed_at: 'TEXT',
    certificate_id: 'TEXT',
    retry_count: 'INTEGER',
    max_retries: 'INTEGER',
    error_message: 'TEXT',
    created_at: 'TEXT',
    updated_at: 'TEXT'
  },
  scan_results: {
    id: 'TEXT',
    request_id: 'TEXT',
    data_type: 'TEXT',
    record_id: 'TEXT',
    record_summary: 'TEXT',
    can_delete: 'INTEGER',
    retention_reason: 'TEXT',
    retention_category: 'TEXT',
    created_at: 'TEXT'
  },
  deletion_executions: {
    id: 'TEXT',
    request_id: 'TEXT',
    scan_result_id: 'TEXT',
    data_type: 'TEXT',
    record_id: 'TEXT',
    action: 'TEXT',
    status: 'TEXT',
    executed_at: 'TEXT',
    error_message: 'TEXT',
    created_at: 'TEXT'
  },
  deletion_certificates: {
    id: 'TEXT',
    request_id: 'TEXT',
    certificate_number: 'TEXT',
    issued_at: 'TEXT',
    issued_by: 'TEXT',
    compliance_view: 'TEXT',
    customer_view: 'TEXT',
    created_at: 'TEXT'
  },
  mock_user_profiles: {
    id: 'TEXT',
    customer_id: 'TEXT',
    name: 'TEXT',
    email: 'TEXT',
    phone: 'TEXT',
    address: 'TEXT',
    created_at: 'TEXT'
  },
  mock_orders: {
    id: 'TEXT',
    customer_id: 'TEXT',
    order_number: 'TEXT',
    amount: 'REAL',
    status: 'TEXT',
    order_date: 'TEXT',
    created_at: 'TEXT'
  },
  mock_support_tickets: {
    id: 'TEXT',
    customer_id: 'TEXT',
    ticket_number: 'TEXT',
    subject: 'TEXT',
    status: 'TEXT',
    created_at: 'TEXT'
  },
  mock_marketing_records: {
    id: 'TEXT',
    customer_id: 'TEXT',
    campaign_name: 'TEXT',
    subscribed_at: 'TEXT',
    created_at: 'TEXT'
  },
  mock_log_indexes: {
    id: 'TEXT',
    customer_id: 'TEXT',
    log_type: 'TEXT',
    log_content: 'TEXT',
    created_at: 'TEXT'
  }
};

const parseQuery = (sql) => {
  const normalized = sql.trim();
  const upper = normalized.toUpperCase();

  if (upper.startsWith('SELECT')) {
    return { type: 'SELECT', sql: normalized };
  } else if (upper.startsWith('INSERT')) {
    return { type: 'INSERT', sql: normalized };
  } else if (upper.startsWith('UPDATE')) {
    return { type: 'UPDATE', sql: normalized };
  } else if (upper.startsWith('DELETE')) {
    return { type: 'DELETE', sql: normalized };
  }

  return { type: 'OTHER', sql: normalized };
};

const matchPattern = (sql, pattern) => {
  const regex = new RegExp(pattern, 'i');
  return regex.exec(sql);
};

const evaluateCondition = (record, field, operator, value) => {
  const recordValue = record[field];

  switch (operator.toUpperCase()) {
    case '=':
    case '==':
      if (typeof value === 'number') {
        return Number(recordValue) === value;
      }
      return recordValue === value;
    case '!=':
    case '<>':
      if (typeof value === 'number') {
        return Number(recordValue) !== value;
      }
      return recordValue !== value;
    case 'IN':
      return Array.isArray(value) && value.includes(recordValue);
    case 'NOT IN':
      return Array.isArray(value) && !value.includes(recordValue);
    case 'IS NULL':
      return recordValue === null || recordValue === undefined;
    case 'IS NOT NULL':
      return recordValue !== null && recordValue !== undefined;
    default:
      return true;
  }
};

const parseWhereClause = (whereClause, params) => {
  let paramIndex = 0;
  const conditions = [];

  const parts = whereClause.split(/\s+AND\s+/i);

  for (const part of parts) {
    const trimmed = part.trim();

    const inMatch = trimmed.match(/^(\w+)\s+IN\s*\(([^)]+)\)$/i);
    if (inMatch) {
      const field = inMatch[1];
      const placeholders = inMatch[2].split(',').map(p => p.trim());
      const values = placeholders.map(() => params[paramIndex++]);
      conditions.push({ field, operator: 'IN', value: values });
      continue;
    }

    const notInMatch = trimmed.match(/^(\w+)\s+NOT\s+IN\s*\(([^)]+)\)$/i);
    if (notInMatch) {
      const field = notInMatch[1];
      const placeholders = notInMatch[2].split(',').map(p => p.trim());
      const values = placeholders.map(() => params[paramIndex++]);
      conditions.push({ field, operator: 'NOT IN', value: values });
      continue;
    }

    const isNullMatch = trimmed.match(/^(\w+)\s+IS\s+NULL$/i);
    if (isNullMatch) {
      conditions.push({ field: isNullMatch[1], operator: 'IS NULL', value: null });
      continue;
    }

    const isNotNullMatch = trimmed.match(/^(\w+)\s+IS\s+NOT\s+NULL$/i);
    if (isNotNullMatch) {
      conditions.push({ field: isNotNullMatch[1], operator: 'IS NOT NULL', value: null });
      continue;
    }

    const eqMatch = trimmed.match(/^(\w+)\s*=\s*\?$/);
    if (eqMatch) {
      conditions.push({ field: eqMatch[1], operator: '=', value: params[paramIndex++] });
      continue;
    }
  }

  return { conditions, paramIndex };
};

const applyConditions = (records, conditions) => {
  return records.filter(record => {
    for (const condition of conditions) {
      if (!evaluateCondition(record, condition.field, condition.operator, condition.value)) {
        return false;
      }
    }
    return true;
  });
};

const executeSelect = (sql, params, mode) => {
  const fromMatch = matchPattern(sql, 'FROM\\s+(\\w+)');
  if (!fromMatch) return mode === 'get' ? undefined : [];

  const tableName = fromMatch[1];
  const tableData = store[tableName];

  if (!tableData) return mode === 'get' ? undefined : [];

  let results = [...tableData];

  const whereMatch = matchPattern(sql, 'WHERE\\s+(.+?)(?:\\s+ORDER|\\s+LIMIT|\\s+GROUP|$)');
  if (whereMatch) {
    const whereClause = whereMatch[1];
    const { conditions } = parseWhereClause(whereClause, params);
    results = applyConditions(results, conditions);
  }

  if (sql.includes('COUNT(*)') || sql.includes('count(*)')) {
    if (matchPattern(sql, 'GROUP\\s+BY')) {
      const groupMatch = matchPattern(sql, 'GROUP\\s+BY\\s+(\\w+(?:,\\s*\\w+)*)');
      if (groupMatch) {
        const groupFields = groupMatch[1].split(',').map(f => f.trim());
        const groups = {};

        for (const record of results) {
          const key = groupFields.map(f => String(record[f])).join('|');
          if (!groups[key]) {
            groups[key] = {};
            for (const field of groupFields) {
              groups[key][field] = record[field];
            }
            groups[key].count = 0;
          }
          groups[key].count++;
        }

        return Object.values(groups);
      }
    }
    return { count: results.length };
  }

  if (mode === 'get') {
    return results[0];
  }

  return results;
};

const executeInsert = (sql, params) => {
  const tableMatch = matchPattern(sql, 'INSERT\\s+INTO\\s+(\\w+)\\s*\\(([^)]+)\\)\\s*VALUES\\s*\\(([^)]+)\\)');
  if (!tableMatch) return { changes: 0 };

  const tableName = tableMatch[1];
  const fields = tableMatch[2].split(',').map(f => f.trim());
  const values = params;

  if (!store[tableName]) {
    store[tableName] = [];
  }

  const record = {};
  fields.forEach((field, index) => {
    record[field] = values[index];
  });

  store[tableName].push(record);

  return { changes: 1 };
};

const executeUpdate = (sql, params) => {
  const tableMatch = matchPattern(sql, 'UPDATE\\s+(\\w+)');
  const setMatch = matchPattern(sql, 'SET\\s+(.+?)(?:\\s+WHERE|$)');
  const whereMatch = matchPattern(sql, 'WHERE\\s+(.+)$');

  if (!tableMatch || !setMatch) return { changes: 0 };

  const tableName = tableMatch[1];
  const setClause = setMatch[1].trim();
  const tableData = store[tableName];

  if (!tableData) return { changes: 0 };

  let paramIndex = 0;
  const updates = {};

  const setParts = setClause.split(',').map(p => p.trim());
  for (const part of setParts) {
    const eqMatch = part.match(/^(\w+)\s*=\s*(.+)$/);
    if (eqMatch) {
      const field = eqMatch[1];
      const valuePart = eqMatch[2].trim();

      if (valuePart === '?') {
        updates[field] = params[paramIndex++];
      } else if (valuePart.toUpperCase() === 'CURRENT_TIMESTAMP') {
        updates[field] = moment().toISOString();
      } else if (valuePart.match(/^'[^']*'$/)) {
        updates[field] = valuePart.slice(1, -1);
      } else if (!isNaN(valuePart)) {
        updates[field] = Number(valuePart);
      } else if (valuePart.toUpperCase().includes('SUBSTR')) {
        const substrMatch = valuePart.match(/SUBSTR\s*\(\s*(\w+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/i);
        if (substrMatch) {
          const srcField = substrMatch[1];
          const start = parseInt(substrMatch[2]);
          const length = parseInt(substrMatch[3]);
          const prefixMatch = valuePart.match(/^'([^']*)'\s*\|\|/);
          const prefix = prefixMatch ? prefixMatch[1] : '';
          updates[field] = (record) => {
            const val = record[srcField] || '';
            return prefix + val.substring(start - 1, start - 1 + length);
          };
        }
      } else {
        updates[field] = valuePart;
      }
    }
  }

  let filteredRecords = tableData;
  if (whereMatch) {
    const { conditions } = parseWhereClause(whereMatch[1], params.slice(paramIndex));
    filteredRecords = applyConditions(tableData, conditions);
  }

  let count = 0;
  for (const record of filteredRecords) {
    for (const [field, value] of Object.entries(updates)) {
      if (typeof value === 'function') {
        record[field] = value(record);
      } else {
        record[field] = value;
      }
    }
    count++;
  }

  return { changes: count };
};

const executeDelete = (sql, params) => {
  const tableMatch = matchPattern(sql, 'DELETE\\s+FROM\\s+(\\w+)');
  const whereMatch = matchPattern(sql, 'WHERE\\s+(.+)$');

  if (!tableMatch) return { changes: 0 };

  const tableName = tableMatch[1];
  const tableData = store[tableName];

  if (!tableData) return { changes: 0 };

  if (!whereMatch) {
    const count = tableData.length;
    store[tableName] = [];
    return { changes: count };
  }

  const { conditions } = parseWhereClause(whereMatch[1], params);
  const recordsToDelete = applyConditions(tableData, conditions);
  const idsToDelete = new Set(recordsToDelete.map(r => r.id));

  const originalLength = tableData.length;
  store[tableName] = tableData.filter(r => !idsToDelete.has(r.id));

  return { changes: originalLength - store[tableName].length };
};

const prepare = (sql) => {
  return {
    get: (...params) => {
      const parsed = parseQuery(sql);
      if (parsed.type === 'SELECT') {
        return executeSelect(parsed.sql, params, 'get');
      }
      return undefined;
    },
    all: (...params) => {
      const parsed = parseQuery(sql);
      if (parsed.type === 'SELECT') {
        return executeSelect(parsed.sql, params, 'all');
      }
      return [];
    },
    run: (...params) => {
      const parsed = parseQuery(sql);
      switch (parsed.type) {
        case 'INSERT':
          return executeInsert(parsed.sql, params);
        case 'UPDATE':
          return executeUpdate(parsed.sql, params);
        case 'DELETE':
          return executeDelete(parsed.sql, params);
        default:
          return { changes: 0 };
      }
    }
  };
};

const exec = (sql) => {
  const statements = sql.split(';').filter(s => s.trim());
  for (const stmt of statements) {
    if (stmt.trim()) {
      const parsed = parseQuery(stmt.trim());
      switch (parsed.type) {
        case 'INSERT':
          executeInsert(parsed.sql, []);
          break;
        case 'UPDATE':
          executeUpdate(parsed.sql, []);
          break;
        case 'DELETE':
          executeDelete(parsed.sql, []);
          break;
        default:
          break;
      }
    }
  }
};

const transaction = (fn) => {
  return (...args) => {
    try {
      return fn(...args);
    } catch (error) {
      throw error;
    }
  };
};

const pragma = () => {};

const initDatabase = () => {
  if (store.mock_user_profiles.length === 0) {
    store.mock_user_profiles = [
      { id: 'p1', customer_id: 'C001', name: '张三', email: 'zhangsan@example.com', phone: '13800138001', address: '北京市朝阳区', created_at: moment().subtract(1, 'year').toISOString() },
      { id: 'p2', customer_id: 'C002', name: '李四', email: 'lisi@example.com', phone: '13800138002', address: '上海市浦东新区', created_at: moment().subtract(2, 'year').toISOString() },
      { id: 'p3', customer_id: 'C003', name: '王五', email: 'wangwu@example.com', phone: '13800138003', address: '广州市天河区', created_at: moment().subtract(3, 'year').toISOString() }
    ];

    store.mock_orders = [
      { id: 'o1', customer_id: 'C001', order_number: 'ORD-2026-001', amount: 999.99, status: 'completed', order_date: '2026-01-15', created_at: '2026-01-15T00:00:00Z' },
      { id: 'o2', customer_id: 'C001', order_number: 'ORD-2026-002', amount: 299.99, status: 'completed', order_date: '2026-04-01', created_at: '2026-04-01T00:00:00Z' },
      { id: 'o3', customer_id: 'C002', order_number: 'ORD-2025-003', amount: 1599.00, status: 'completed', order_date: '2025-01-10', created_at: '2025-01-10T00:00:00Z' }
    ];

    store.mock_support_tickets = [
      { id: 't1', customer_id: 'C001', ticket_number: 'TKT-001', subject: '产品咨询', status: 'closed', created_at: moment().subtract(100, 'days').toISOString() },
      { id: 't2', customer_id: 'C002', ticket_number: 'TKT-002', subject: '退款申请', status: 'open', created_at: moment().subtract(5, 'days').toISOString() },
      { id: 't3', customer_id: 'C003', ticket_number: 'TKT-003', subject: '技术支持', status: 'closed', created_at: moment().subtract(200, 'days').toISOString() }
    ];

    store.mock_marketing_records = [
      { id: 'm1', customer_id: 'C001', campaign_name: '春节促销', subscribed_at: '2026-02-01', created_at: '2026-02-01T00:00:00Z' },
      { id: 'm2', customer_id: 'C002', campaign_name: '会员专享', subscribed_at: '2025-11-15', created_at: '2025-11-15T00:00:00Z' }
    ];

    store.mock_log_indexes = [
      { id: 'l1', customer_id: 'C001', log_type: 'login', log_content: '用户登录系统', created_at: moment().subtract(30, 'days').toISOString() },
      { id: 'l2', customer_id: 'C001', log_type: 'purchase', log_content: '用户购买商品', created_at: moment().subtract(200, 'days').toISOString() },
      { id: 'l3', customer_id: 'C002', log_type: 'login', log_content: '用户登录系统', created_at: moment().subtract(200, 'days').toISOString() }
    ];
  }
};

const resetStore = () => {
  store = {
    deletion_requests: [],
    scan_results: [],
    deletion_executions: [],
    deletion_certificates: [],
    mock_user_profiles: [],
    mock_orders: [],
    mock_support_tickets: [],
    mock_marketing_records: [],
    mock_log_indexes: []
  };
  initDatabase();
};

module.exports = {
  db: { prepare, exec, transaction, pragma },
  initDatabase,
  resetStore
};
