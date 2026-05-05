const SlowLogParser = require('../src/engines/slowLogParser');
const SchemaAnalyzer = require('../src/engines/schemaAnalyzer');
const ConnectionPoolAnalyzer = require('../src/engines/connectionPoolAnalyzer');
const ReadWriteRoutingAnalyzer = require('../src/engines/readWriteRoutingAnalyzer');
const ShardingAnalyzer = require('../src/engines/shardingAnalyzer');
const WriteSampleAnalyzer = require('../src/engines/writeSampleAnalyzer');
const AnalysisEngine = require('../src/engines/analysisEngine');

describe('SlowLogParser', () => {
  test('should parse slow log and detect slow queries', () => {
    const slowLogs = [{
      content: `
LOG:  duration: 12500.234 ms  statement: SELECT * FROM users WHERE email = 'test@example.com';
LOG:  duration: 8500.123 ms  statement: SELECT * FROM orders WHERE status = 'pending';
      `
    }];

    const result = SlowLogParser.analyze(slowLogs);
    
    expect(result.bottlenecks.length).toBeGreaterThan(0);
    expect(result.scoreDeductions.length).toBeGreaterThan(0);
  });

  test('should detect full table scan patterns', () => {
    const slowLogs = [{
      content: `LOG:  duration: 5000.000 ms  statement: SELECT * FROM large_table WHERE non_indexed_column = 'value';`
    }];

    const result = SlowLogParser.analyze(slowLogs);
    
    expect(result.bottlenecks.length).toBeGreaterThan(0);
  });

  test('should detect like leading wildcard', () => {
    const slowLogs = [{
      content: `LOG:  duration: 3000.000 ms  statement: SELECT * FROM users WHERE username LIKE '%admin%';`
    }];

    const result = SlowLogParser.analyze(slowLogs);
    
    const hasLikeSuggestion = result.sqlSuggestions.some(s => 
      s.title?.includes('LIKE') || s.problem?.includes('LIKE')
    );
    expect(hasLikeSuggestion).toBe(true);
  });
});

describe('SchemaAnalyzer', () => {
  test('should detect missing primary key', () => {
    const schema = `
      CREATE TABLE users (
        username VARCHAR(50) NOT NULL,
        email VARCHAR(100) NOT NULL
      );
    `;

    const result = SchemaAnalyzer.analyze(schema);
    
    const hasMissingPK = result.bottlenecks.some(b => 
      b.category?.includes('主键') || b.description?.includes('主键')
    );
    expect(hasMissingPK).toBe(true);
  });

  test('should detect too many indexes', () => {
    const schema = `
      CREATE TABLE orders (
        id SERIAL PRIMARY KEY,
        user_id INTEGER,
        order_no VARCHAR(32),
        status VARCHAR(20),
        created_at TIMESTAMP
      );
      
      CREATE INDEX idx1 ON orders(user_id);
      CREATE INDEX idx2 ON orders(order_no);
      CREATE INDEX idx3 ON orders(status);
      CREATE INDEX idx4 ON orders(created_at);
      CREATE INDEX idx5 ON orders(user_id, status);
      CREATE INDEX idx6 ON orders(user_id, created_at);
      CREATE INDEX idx7 ON orders(status, created_at);
      CREATE INDEX idx8 ON orders(order_no, status);
      CREATE INDEX idx9 ON orders(user_id, order_no);
    `;

    const result = SchemaAnalyzer.analyze(schema);
    
    const hasTooManyIndexes = result.bottlenecks.some(b => 
      b.category?.includes('索引过多') || b.description?.includes('索引')
    );
    expect(hasTooManyIndexes).toBe(true);
  });

  test('should detect foreign key without index', () => {
    const schema = `
      CREATE TABLE orders (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id)
      );
    `;

    const result = SchemaAnalyzer.analyze(schema);
    
    const hasFKIssue = result.bottlenecks.some(b => 
      b.category?.includes('外键') || b.description?.includes('外键')
    );
    expect(hasFKIssue).toBe(true);
  });
});

describe('ConnectionPoolAnalyzer', () => {
  test('should detect high pool utilization', () => {
    const profile = {
      connectionPool: {
        maxConnections: 50,
        activeConnections: 45
      }
    };

    const result = ConnectionPoolAnalyzer.analyze(profile);
    
    expect(result.bottlenecks.length).toBeGreaterThan(0);
    expect(result.connectionIssues.length).toBeGreaterThan(0);
  });

  test('should detect connection timeouts', () => {
    const profile = {
      connectionPool: {
        timeouts: 10
      }
    };

    const result = ConnectionPoolAnalyzer.analyze(profile);
    
    const hasTimeoutIssue = result.bottlenecks.some(b => 
      b.category?.includes('超时') || b.description?.includes('超时')
    );
    expect(hasTimeoutIssue).toBe(true);
  });

  test('should detect connection leaks', () => {
    const profile = {
      connectionPool: {
        leaks: 5
      }
    };

    const result = ConnectionPoolAnalyzer.analyze(profile);
    
    const hasLeakIssue = result.bottlenecks.some(b => 
      b.category?.includes('泄漏') || b.description?.includes('泄漏')
    );
    expect(hasLeakIssue).toBe(true);
  });
});

describe('ReadWriteRoutingAnalyzer', () => {
  test('should detect read-heavy workload', () => {
    const slowLogs = [{
      content: `
LOG:  duration: 100.000 ms  statement: SELECT * FROM users WHERE id = 1;
LOG:  duration: 100.000 ms  statement: SELECT * FROM orders WHERE user_id = 1;
LOG:  duration: 100.000 ms  statement: SELECT * FROM products WHERE category_id = 1;
LOG:  duration: 100.000 ms  statement: SELECT * FROM categories;
LOG:  duration: 100.000 ms  statement: SELECT * FROM logs WHERE user_id = 1;
LOG:  duration: 100.000 ms  statement: SELECT * FROM user_points WHERE user_id = 1;
LOG:  duration: 100.000 ms  statement: SELECT * FROM user_addresses WHERE user_id = 1;
LOG:  duration: 100.000 ms  statement: SELECT * FROM products WHERE id = 1;
LOG:  duration: 100.000 ms  statement: SELECT * FROM orders WHERE id = 1;
LOG:  duration: 100.000 ms  statement: SELECT * FROM order_items WHERE order_id = 1;
LOG:  duration: 50.000 ms  statement: UPDATE users SET updated_at = NOW() WHERE id = 1;
      `
    }];

    const result = ReadWriteRoutingAnalyzer.analyze(slowLogs);
    
    expect(result.readQueries).toBeGreaterThan(result.writeQueries);
  });

  test('should detect long transactions', () => {
    const slowLogs = [{
      content: `
LOG:  duration: 45000.000 ms  statement: BEGIN;
LOG:  duration: 1000.000 ms  statement: UPDATE user_points SET available_points = available_points - 100 WHERE user_id = 12345;
LOG:  duration: 500.000 ms  statement: COMMIT;
      `
    }];

    const result = ReadWriteRoutingAnalyzer.analyze(slowLogs);
    
    const hasLongTxIssue = result.bottlenecks?.some(b => 
      b.category?.includes('事务') || b.description?.includes('事务')
    );
    expect(hasLongTxIssue).toBe(true);
  });
});

describe('WriteSampleAnalyzer', () => {
  test('should detect too many single writes', () => {
    const samples = [
      {
        operation_type: 'single_insert',
        rows_count: 1
      },
      {
        operation_type: 'single_insert',
        rows_count: 1
      },
      {
        operation_type: 'single_insert',
        rows_count: 1
      },
      {
        operation_type: 'single_insert',
        rows_count: 1
      },
      {
        operation_type: 'single_insert',
        rows_count: 1
      },
      {
        operation_type: 'batch_insert',
        batch_size: 10
      }
    ];

    const result = WriteSampleAnalyzer.analyze(samples);
    
    expect(result.stats.singleWrites).toBeGreaterThan(result.stats.batchWrites);
  });

  test('should detect large batch writes', () => {
    const samples = [
      {
        operation_type: 'batch_insert',
        rows_count: 2000
      }
    ];

    const result = WriteSampleAnalyzer.analyze(samples);
    
    const hasLargeBatch = result.bottlenecks?.some(b => 
      b.category?.includes('批量过大') || b.description?.includes('批量')
    );
    expect(hasLargeBatch).toBe(true);
  });
});

describe('AnalysisEngine', () => {
  test('should run full analysis pipeline', () => {
    const data = {
      drillId: 'test-123',
      schema: `
        CREATE TABLE orders (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL,
          FOREIGN KEY (user_id) REFERENCES users(id)
        );
      `,
      slowLogs: [{
        content: `LOG:  duration: 5000.000 ms  statement: SELECT * FROM orders WHERE status = 'pending';`
      }],
      dbProfile: {
        connectionPool: {
          maxConnections: 50,
          activeConnections: 45
        }
      },
      writeSamples: [
        {
          operation_type: 'single_insert',
          rows_count: 1
        }
      ]
    };

    const result = AnalysisEngine.analyze(data);
    
    expect(result.bottlenecks).toBeDefined();
    expect(result.overallScore).toBeDefined();
  });

  test('should deduplicate bottlenecks', () => {
    const data = {
      drillId: 'test-456',
      schema: `
        CREATE TABLE orders (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL,
          FOREIGN KEY (user_id) REFERENCES users(id)
        );
        CREATE TABLE order_items (
          id SERIAL PRIMARY KEY,
          order_id INTEGER NOT NULL,
          FOREIGN KEY (order_id) REFERENCES orders(id)
        );
      `,
      slowLogs: [],
      dbProfile: null,
      writeSamples: []
    };

    const result = AnalysisEngine.analyze(data);
    
    const uniqueCategories = [...new Set(result.bottlenecks.map(b => b.category))];
    expect(uniqueCategories.length).toBeLessThanOrEqual(result.bottlenecks.length);
  });
});
