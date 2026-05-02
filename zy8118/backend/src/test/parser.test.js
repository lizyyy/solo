import test from 'node:test';
import assert from 'node:assert/strict';
import { OpenAPIParser, JSONLParser } from '../parser/index.js';

test('OpenAPIParser - should parse valid OpenAPI YAML', async () => {
  const yamlContent = `
openapi: 3.0.0
info:
  title: Test API
  version: 1.0.0
paths:
  /users:
    get:
      operationId: getUsers
      responses:
        '200':
          description: OK
`;

  const result = await OpenAPIParser.parse(yamlContent, true);
  
  assert.equal(result.success, true);
  assert.equal(result.data.info.title, 'Test API');
  assert.equal(result.data.info.version, '1.0.0');
});

test('OpenAPIParser - should generate operationId when missing', async () => {
  const yamlContent = `
openapi: 3.0.0
info:
  title: Test API
  version: 1.0.0
paths:
  /users/{id}:
    get:
      responses:
        '200':
          description: OK
`;

  const result = await OpenAPIParser.parse(yamlContent, true);
  const operations = OpenAPIParser.extractOperations(result.data);
  
  assert.equal(operations.length, 1);
  assert.ok(operations[0].operationId.includes('getUsers'));
});

test('JSONLParser - should parse valid JSONL', () => {
  const jsonlContent = `{"id": 1, "name": "test1"}
{"id": 2, "name": "test2"}`;

  const result = JSONLParser.parse(jsonlContent);
  
  assert.equal(result.success, true);
  assert.equal(result.data.length, 2);
  assert.equal(result.data[0].id, 1);
  assert.equal(result.data[1].id, 2);
});

test('JSONLParser - should handle parse errors', () => {
  const jsonlContent = `{"id": 1}
invalid json
{"id": 2}`;

  const result = JSONLParser.parse(jsonlContent);
  
  assert.equal(result.success, false);
  assert.equal(result.errors.length, 1);
  assert.equal(result.errors[0].line, 2);
});

test('JSONLParser - should extract request response pairs', () => {
  const records = [
    {
      request: {
        method: 'GET',
        url: '/api/users',
        headers: { 'Content-Type': 'application/json' }
      },
      response: {
        status: 200,
        body: { users: [] }
      },
      mockResponse: {
        status: 200,
        body: { users: [{ id: 1, name: 'Mock' }] }
      }
    }
  ];

  const pairs = JSONLParser.extractRequestResponsePairs(records);
  
  assert.equal(pairs.length, 1);
  assert.equal(pairs[0].request.method, 'GET');
  assert.equal(pairs[0].response.status, 200);
  assert.ok(pairs[0].mockResponse !== null);
});
