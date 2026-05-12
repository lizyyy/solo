const testSamples = {
  databaseSlow: {
    request_url: 'https://api.example.com/api/users/list',
    http_method: 'GET',
    request_headers: {
      'Content-Type': 'application/json',
      'X-User-Id': '12345',
    },
    request_body: {
      page: 1,
      size: 50,
    },
    response_status: 200,
    response_time_ms: 2500,
    trace_id: 'trace-db-001',
    user_id: 'user_123',
    ip_address: '192.168.1.100',
    sql_summaries: [
      {
        sql_hash: 'abc123',
        sql_template: 'SELECT * FROM users WHERE status = ? ORDER BY created_at DESC LIMIT ?',
        execution_time_ms: 1200,
        rows_affected: 50,
        database_type: 'mysql',
      },
      {
        sql_hash: 'def456',
        sql_template: 'SELECT COUNT(*) FROM user_orders WHERE user_id = ?',
        execution_time_ms: 800,
        rows_affected: 1,
        database_type: 'mysql',
      },
    ],
    external_deps: [
      {
        dep_name: 'redis',
        dep_type: 'redis',
        execution_time_ms: 50,
        status: 'success',
      },
    ],
    raw_log: '2024-01-15 10:00:00 [INFO] GET /api/users/list completed in 2500ms',
  },

  downstreamSlow: {
    request_url: 'https://api.example.com/api/orders/process',
    http_method: 'POST',
    request_headers: {
      'Content-Type': 'application/json',
    },
    request_body: {
      order_id: 'ORD_12345',
      amount: 99.99,
    },
    response_status: 200,
    response_time_ms: 3200,
    trace_id: 'trace-down-001',
    user_id: 'user_456',
    ip_address: '10.0.0.50',
    sql_summaries: [
      {
        sql_hash: 'ghi789',
        sql_template: 'UPDATE orders SET status = ? WHERE id = ?',
        execution_time_ms: 150,
        rows_affected: 1,
        database_type: 'mysql',
      },
    ],
    external_deps: [
      {
        dep_name: 'payment-service',
        dep_type: 'http',
        execution_time_ms: 2500,
        endpoint: 'https://payment.example.com/api/charge',
        status: 'success',
      },
      {
        dep_name: 'notification-service',
        dep_type: 'http',
        execution_time_ms: 300,
        endpoint: 'https://notify.example.com/api/send',
        status: 'success',
      },
    ],
    raw_log: '2024-01-15 10:05:00 [INFO] POST /api/orders/process completed in 3200ms',
  },

  cachePenetration: {
    request_url: 'https://api.example.com/api/products/detail?id=-1',
    http_method: 'GET',
    request_headers: {
      'Content-Type': 'application/json',
    },
    request_body: {},
    response_status: 404,
    response_time_ms: 1800,
    trace_id: 'trace-cache-001',
    user_id: 'user_789',
    ip_address: '172.16.0.20',
    sql_summaries: [
      {
        sql_hash: 'jkl012',
        sql_template: 'SELECT * FROM products WHERE id = ?',
        execution_time_ms: 1500,
        rows_affected: 0,
        database_type: 'postgresql',
      },
    ],
    external_deps: [
      {
        dep_name: 'redis',
        dep_type: 'redis',
        execution_time_ms: 10,
        status: 'success',
      },
    ],
    raw_log: '2024-01-15 10:10:00 [WARN] GET /api/products/detail?id=-1 cache miss, query DB returned empty',
  },

  parameterError: {
    request_url: 'https://api.example.com/api/carts/update',
    http_method: 'PUT',
    request_headers: {
      'Content-Type': 'application/json',
    },
    request_body: {
      product_id: null,
      quantity: -1,
    },
    response_status: 400,
    response_time_ms: 1500,
    trace_id: 'trace-param-001',
    user_id: 'user_321',
    ip_address: '192.168.2.10',
    sql_summaries: [],
    external_deps: [],
    raw_log: '2024-01-15 10:15:00 [ERROR] PUT /api/carts/update - Invalid product_id: null',
  },

  unknownCategory: {
    request_url: 'https://api.example.com/api/reports/generate',
    http_method: 'POST',
    request_headers: {
      'Content-Type': 'application/json',
    },
    request_body: {
      report_type: 'daily',
      date_range: '2024-01-01,2024-01-15',
    },
    response_status: 200,
    response_time_ms: 4500,
    trace_id: null,
    user_id: 'user_654',
    ip_address: '10.10.10.10',
    sql_summaries: [
      {
        sql_hash: 'mno345',
        sql_template: 'SELECT * FROM transactions WHERE date BETWEEN ? AND ?',
        execution_time_ms: 300,
        rows_affected: 1000,
        database_type: 'mysql',
      },
    ],
    external_deps: [
      {
        dep_name: 's3',
        dep_type: 'storage',
        execution_time_ms: 200,
        status: 'success',
      },
    ],
    raw_log: '2024-01-15 10:20:00 [INFO] POST /api/reports/generate - report generated in 4500ms',
  },

  duplicateRequest: {
    request_url: 'https://api.example.com/api/users/list',
    http_method: 'GET',
    request_headers: {
      'Content-Type': 'application/json',
      'X-User-Id': '12345',
    },
    request_body: {
      page: 2,
      size: 50,
    },
    response_status: 200,
    response_time_ms: 2300,
    trace_id: 'trace-db-002',
    user_id: 'user_999',
    ip_address: '192.168.1.200',
    sql_summaries: [
      {
        sql_hash: 'abc123',
        sql_template: 'SELECT * FROM users WHERE status = ? ORDER BY created_at DESC LIMIT ?',
        execution_time_ms: 1100,
        rows_affected: 50,
        database_type: 'mysql',
      },
    ],
    external_deps: [],
    raw_log: '2024-01-15 10:25:00 [INFO] GET /api/users/list completed in 2300ms',
  },
};

module.exports = testSamples;
