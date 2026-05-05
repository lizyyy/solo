import { parseApiLog } from '../src/parsers/api-log-parser';
import { parseSqlLog } from '../src/parsers/sql-log-parser';
import { parseRepositoryMethods } from '../src/parsers/repository-methods-parser';
import { parseTableStructure } from '../src/parsers/table-structure-parser';
import { RequestGrouper, groupRequests } from '../src/parsers/request-grouper';

describe('api-log-parser', () => {
  describe('parseApiLog', () => {
    it('should parse JSON format API log', () => {
      const jsonContent = JSON.stringify([
        {
          requestId: 'req_001',
          timestamp: '2024-01-15T10:00:00.000Z',
          method: 'GET',
          path: '/api/users',
          statusCode: 200,
          duration: 150,
          userId: 'user_123'
        }
      ]);

      const logs = parseApiLog(jsonContent, { format: 'json' });
      
      expect(logs.length).toBe(1);
      expect(logs[0].requestId).toBe('req_001');
      expect(logs[0].method).toBe('GET');
      expect(logs[0].path).toBe('/api/users');
      expect(logs[0].statusCode).toBe(200);
      expect(logs[0].duration).toBe(150);
    });

    it('should parse single object JSON', () => {
      const jsonContent = JSON.stringify({
        requestId: 'req_002',
        method: 'POST',
        path: '/api/posts',
        statusCode: 201
      });

      const logs = parseApiLog(jsonContent, { format: 'json' });
      
      expect(logs.length).toBe(1);
      expect(logs[0].requestId).toBe('req_002');
      expect(logs[0].method).toBe('POST');
    });

    it('should parse NDJSON format', () => {
      const ndjsonContent = [
        JSON.stringify({ requestId: 'req_001', method: 'GET', path: '/api/1' }),
        JSON.stringify({ requestId: 'req_002', method: 'POST', path: '/api/2' }),
      ].join('\n');

      const logs = parseApiLog(ndjsonContent, { format: 'json' });
      
      expect(logs.length).toBe(2);
      expect(logs[0].requestId).toBe('req_001');
      expect(logs[1].requestId).toBe('req_002');
    });

    it('should handle different field names', () => {
      const jsonContent = JSON.stringify([
        {
          traceId: 'trace_001',
          httpMethod: 'PUT',
          url: '/api/update',
          status: 204,
          responseTime: 75
        }
      ]);

      const logs = parseApiLog(jsonContent, { format: 'json' });
      
      expect(logs.length).toBe(1);
      expect(logs[0].requestId).toBe('trace_001');
      expect(logs[0].method).toBe('PUT');
      expect(logs[0].path).toBe('/api/update');
      expect(logs[0].statusCode).toBe(204);
      expect(logs[0].duration).toBe(75);
    });

    it('should parse CSV format', () => {
      const csvContent = `requestId,method,path,statusCode,duration
req_001,GET,/api/users,200,150
req_002,POST,/api/posts,201,200`;

      const logs = parseApiLog(csvContent, { format: 'csv' });
      
      expect(logs.length).toBe(2);
      expect(logs[0].requestId).toBe('req_001');
      expect(logs[0].method).toBe('GET');
      expect(logs[1].path).toBe('/api/posts');
    });

    it('should parse plain text format', () => {
      const plainContent = `2024-01-15T10:00:00.000Z GET /api/users 200 150ms requestId: req_001
2024-01-15T10:00:01.000Z POST /api/posts 201 200ms requestId: req_002`;

      const logs = parseApiLog(plainContent, { format: 'plain' });
      
      expect(logs.length).toBe(2);
      expect(logs[0].method).toBe('GET');
      expect(logs[0].path).toBe('/api/users');
    });
  });
});

describe('sql-log-parser', () => {
  describe('parseSqlLog', () => {
    it('should parse JSON format SQL log', () => {
      const jsonContent = JSON.stringify([
        {
          requestId: 'req_001',
          timestamp: '2024-01-15T10:00:00.100Z',
          sql: 'SELECT * FROM users WHERE id = 1',
          duration: 5,
          rowsAffected: 1,
          tableName: 'users',
          operationType: 'SELECT'
        }
      ]);

      const queries = parseSqlLog(jsonContent, { format: 'json' });
      
      expect(queries.length).toBe(1);
      expect(queries[0].requestId).toBe('req_001');
      expect(queries[0].sql).toBe('SELECT * FROM users WHERE id = 1');
      expect(queries[0].duration).toBe(5);
      expect(queries[0].operationType).toBe('SELECT');
    });

    it('should extract operation type from SQL', () => {
      const jsonContent = JSON.stringify([
        { sql: 'SELECT * FROM users' },
        { sql: 'INSERT INTO users (name) VALUES (?)' },
        { sql: 'UPDATE users SET name = ?' },
        { sql: 'DELETE FROM users' },
      ]);

      const queries = parseSqlLog(jsonContent, { format: 'json' });
      
      expect(queries[0].operationType).toBe('SELECT');
      expect(queries[1].operationType).toBe('INSERT');
      expect(queries[2].operationType).toBe('UPDATE');
      expect(queries[3].operationType).toBe('DELETE');
    });

    it('should extract table name from SQL', () => {
      const jsonContent = JSON.stringify([
        { sql: 'SELECT * FROM users' },
        { sql: 'SELECT u.* FROM users u JOIN posts p ON u.id = p.author_id' },
      ]);

      const queries = parseSqlLog(jsonContent, { format: 'json' });
      
      expect(queries[0].tableName).toBe('users');
    });

    it('should normalize SQL', () => {
      const jsonContent = JSON.stringify([
        { sql: 'SELECT * FROM users WHERE id = 1' },
        { sql: 'SELECT * FROM users WHERE id = 2' },
      ]);

      const queries = parseSqlLog(jsonContent, { format: 'json', normalizeSql: true });
      
      expect(queries[0].normalizedSql).toBeDefined();
      expect(queries[0].normalizedSql).toBe(queries[1].normalizedSql);
    });
  });
});

describe('request-grouper', () => {
  describe('RequestGrouper', () => {
    it('should group logs and queries by requestId', () => {
      const grouper = new RequestGrouper();
      
      grouper.addApiLogs([
        { id: '1', requestId: 'req_001', timestamp: new Date(), method: 'GET', path: '/api/1', statusCode: 200, duration: 100 },
        { id: '2', requestId: 'req_002', timestamp: new Date(), method: 'POST', path: '/api/2', statusCode: 201, duration: 200 },
      ] as any);
      
      grouper.addSqlQueries([
        { id: 'q1', requestId: 'req_001', timestamp: new Date(), sql: 'SELECT 1', normalizedSql: 'SELECT ?', parameters: [], duration: 5, operationType: 'SELECT' as const, joinTables: [], whereClauses: [], selectFields: [] },
        { id: 'q2', requestId: 'req_001', timestamp: new Date(), sql: 'SELECT 2', normalizedSql: 'SELECT ?', parameters: [], duration: 10, operationType: 'SELECT' as const, joinTables: [], whereClauses: [], selectFields: [] },
        { id: 'q3', requestId: 'req_002', timestamp: new Date(), sql: 'INSERT INTO test', normalizedSql: 'INSERT INTO test', parameters: [], duration: 15, operationType: 'INSERT' as const, joinTables: [], whereClauses: [], selectFields: [] },
      ] as any);

      const groups = grouper.group();
      
      expect(groups.length).toBe(2);
      
      const group1 = groups.find(g => g.requestId === 'req_001');
      expect(group1).toBeDefined();
      expect(group1?.sqlQueries.length).toBe(2);
      expect(group1?.totalQueryCount).toBe(2);
      
      const group2 = groups.find(g => g.requestId === 'req_002');
      expect(group2).toBeDefined();
      expect(group2?.sqlQueries.length).toBe(1);
    });

    it('should handle logs without requestId', () => {
      const grouper = new RequestGrouper();
      
      grouper.addApiLogs([
        { id: '1', timestamp: new Date(), method: 'GET', path: '/api/1', statusCode: 200, duration: 100 },
      ] as any);
      
      grouper.addSqlQueries([
        { id: 'q1', timestamp: new Date(), sql: 'SELECT 1', normalizedSql: 'SELECT ?', parameters: [], duration: 5, operationType: 'SELECT' as const, joinTables: [], whereClauses: [], selectFields: [] },
      ] as any);

      const groups = grouper.group();
      
      expect(groups.length).toBeGreaterThan(0);
    });

    it('should sort queries by timestamp', () => {
      const grouper = new RequestGrouper();
      const now = Date.now();
      
      grouper.addSqlQueries([
        { id: 'q2', requestId: 'req_001', timestamp: new Date(now + 100), sql: 'second', normalizedSql: 'second', parameters: [], duration: 5, operationType: 'SELECT' as const, joinTables: [], whereClauses: [], selectFields: [] },
        { id: 'q1', requestId: 'req_001', timestamp: new Date(now), sql: 'first', normalizedSql: 'first', parameters: [], duration: 5, operationType: 'SELECT' as const, joinTables: [], whereClauses: [], selectFields: [] },
        { id: 'q3', requestId: 'req_001', timestamp: new Date(now + 200), sql: 'third', normalizedSql: 'third', parameters: [], duration: 5, operationType: 'SELECT' as const, joinTables: [], whereClauses: [], selectFields: [] },
      ] as any);

      const groups = grouper.group();
      const group = groups[0];
      
      expect(group.sqlQueries[0].sql).toBe('first');
      expect(group.sqlQueries[1].sql).toBe('second');
      expect(group.sqlQueries[2].sql).toBe('third');
    });

    it('should group queries by table and operation', () => {
      const grouper = new RequestGrouper();
      
      grouper.addSqlQueries([
        { id: 'q1', requestId: 'req_001', timestamp: new Date(), sql: 'SELECT * FROM users', normalizedSql: 'SELECT * FROM users', parameters: [], duration: 5, tableName: 'users', operationType: 'SELECT' as const, joinTables: [], whereClauses: [], selectFields: [] },
        { id: 'q2', requestId: 'req_001', timestamp: new Date(), sql: 'SELECT * FROM posts', normalizedSql: 'SELECT * FROM posts', parameters: [], duration: 10, tableName: 'posts', operationType: 'SELECT' as const, joinTables: [], whereClauses: [], selectFields: [] },
        { id: 'q3', requestId: 'req_001', timestamp: new Date(), sql: 'INSERT INTO posts', normalizedSql: 'INSERT INTO posts', parameters: [], duration: 15, tableName: 'posts', operationType: 'INSERT' as const, joinTables: [], whereClauses: [], selectFields: [] },
      ] as any);

      const groups = grouper.group();
      const group = groups[0];
      
      expect(group.queryByTable['users']?.length).toBe(1);
      expect(group.queryByTable['posts']?.length).toBe(2);
      expect(group.queryByOperation['SELECT']?.length).toBe(2);
      expect(group.queryByOperation['INSERT']?.length).toBe(1);
    });
  });

  describe('groupRequests', () => {
    it('should be a convenience function for RequestGrouper', () => {
      const logs = [
        { id: '1', requestId: 'req_001', timestamp: new Date(), method: 'GET', path: '/api/1', statusCode: 200, duration: 100 },
      ] as any;
      
      const queries = [
        { id: 'q1', requestId: 'req_001', timestamp: new Date(), sql: 'SELECT 1', normalizedSql: 'SELECT ?', parameters: [], duration: 5, operationType: 'SELECT' as const, joinTables: [], whereClauses: [], selectFields: [] },
      ] as any;

      const groups = groupRequests(logs, queries);
      
      expect(groups.length).toBe(1);
      expect(groups[0].requestId).toBe('req_001');
    });
  });
});

describe('repository-methods-parser', () => {
  describe('parseRepositoryMethods', () => {
    it('should parse YAML format', () => {
      const yamlContent = `version: "1.0"
repositories:
  - name: UserRepository
    tableName: users
    methods:
      - methodName: findById
        operationType: SELECT
        expectedParameters:
          - name: id
            type: number
            required: true`;

      const config = parseRepositoryMethods(yamlContent);
      
      expect(config.version).toBe('1.0');
      expect(config.repositories.length).toBe(1);
      expect(config.repositories[0].name).toBe('UserRepository');
      expect(config.repositories[0].methods.length).toBe(1);
      expect(config.repositories[0].methods[0].methodName).toBe('findById');
    });

    it('should parse JSON format', () => {
      const jsonContent = JSON.stringify({
        version: '1.0',
        repositories: [
          {
            name: 'PostRepository',
            tableName: 'posts',
            methods: [
              {
                methodName: 'findAll',
                operationType: 'SELECT'
              }
            ]
          }
        ]
      });

      const config = parseRepositoryMethods(jsonContent);
      
      expect(config.version).toBe('1.0');
      expect(config.repositories.length).toBe(1);
      expect(config.repositories[0].name).toBe('PostRepository');
    });

    it('should return empty config for invalid content', () => {
      const config = parseRepositoryMethods('invalid content');
      
      expect(config.version).toBe('1.0.0');
      expect(config.repositories.length).toBe(0);
    });

    it('should parse method parameters correctly', () => {
      const yamlContent = `version: "1.0"
repositories:
  - name: TestRepository
    tableName: test
    methods:
      - methodName: findByParams
        operationType: SELECT
        expectedParameters:
          - name: id
            type: number
            required: true
          - name: name
            type: string
            required: false
            defaultValue: "default"`;

      const config = parseRepositoryMethods(yamlContent);
      
      expect(config.repositories[0].methods[0].expectedParameters.length).toBe(2);
      expect(config.repositories[0].methods[0].expectedParameters[0].name).toBe('id');
      expect(config.repositories[0].methods[0].expectedParameters[0].required).toBe(true);
      expect(config.repositories[0].methods[0].expectedParameters[1].defaultValue).toBe('default');
    });
  });
});

describe('table-structure-parser', () => {
  describe('parseTableStructure', () => {
    it('should parse JSON format table structure', () => {
      const jsonContent = JSON.stringify([
        {
          tableName: 'users',
          columns: [
            { name: 'id', dataType: 'BIGINT', nullable: false, isPrimaryKey: true, isAutoIncrement: true },
            { name: 'name', dataType: 'VARCHAR(255)', nullable: false, isPrimaryKey: false, isAutoIncrement: false }
          ],
          primaryKey: { columns: ['id'] },
          indexes: [
            { name: 'PRIMARY', columns: ['id'], isUnique: true, isPrimary: true }
          ],
          foreignKeys: [],
          estimatedRowCount: 10000
        }
      ]);

      const structures = parseTableStructure(jsonContent, { format: 'json' });
      
      expect(structures.length).toBe(1);
      expect(structures[0].tableName).toBe('users');
      expect(structures[0].columns.length).toBe(2);
      expect(structures[0].primaryKey?.columns).toEqual(['id']);
    });

    it('should handle empty array', () => {
      const structures = parseTableStructure('[]', { format: 'json' });
      expect(structures.length).toBe(0);
    });
  });
});
