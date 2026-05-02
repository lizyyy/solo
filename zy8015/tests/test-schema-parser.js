const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');

const SchemaParser = require('../src/schema-parser');

const EXAMPLES_DIR = path.join(__dirname, '..', 'examples');

test('SchemaParser - should parse JSON schema', () => {
  const parser = new SchemaParser();
  const schemaPath = path.join(EXAMPLES_DIR, 'schema.json');
  const schema = parser.parse(schemaPath);

  assert.ok(schema);
  assert.strictEqual(schema.version, '2.0.0');
  assert.ok(schema.tools);
  assert.ok(schema.tools.get_user);
  assert.ok(schema.tools.create_user);
  assert.ok(schema.tools.update_user);
  assert.ok(schema.tools.delete_user);
  assert.ok(schema.tools.list_users);
  assert.ok(schema.tools.search_files);
});

test('SchemaParser - should parse YAML schema', () => {
  const parser = new SchemaParser();
  const yamlContent = `
version: 1.0.0
tools:
  - name: test_tool
    description: A test tool
    parameters:
      type: object
      properties:
        param1:
          type: string
          description: First parameter
      required:
        - param1
`;

  const tempPath = path.join(__dirname, 'temp-schema.yaml');
  fs.writeFileSync(tempPath, yamlContent);

  try {
    const schema = parser.parse(tempPath);
    assert.ok(schema);
    assert.strictEqual(schema.version, '1.0.0');
    assert.ok(schema.tools.test_tool);
  } finally {
    fs.unlinkSync(tempPath);
  }
});

test('SchemaParser - should validate valid tool call', () => {
  const parser = new SchemaParser();
  const schemaPath = path.join(EXAMPLES_DIR, 'schema.json');
  const schema = parser.parse(schemaPath);

  const result = parser.validateToolCall('get_user', { user_id: 'u-001' }, schema);

  assert.strictEqual(result.valid, true);
  assert.strictEqual(result.issues.length, 0);
});

test('SchemaParser - should detect missing required parameter', () => {
  const parser = new SchemaParser();
  const schemaPath = path.join(EXAMPLES_DIR, 'schema.json');
  const schema = parser.parse(schemaPath);

  const result = parser.validateToolCall('get_user', {}, schema);

  assert.strictEqual(result.valid, false);
  assert.strictEqual(result.issues.length, 1);
  assert.strictEqual(result.issues[0].type, 'missing_required_parameter');
});

test('SchemaParser - should detect unknown parameter', () => {
  const parser = new SchemaParser();
  const schemaPath = path.join(EXAMPLES_DIR, 'schema.json');
  const schema = parser.parse(schemaPath);

  const result = parser.validateToolCall('get_user', { user_id: 'u-001', unknown_param: 'value' }, schema);

  assert.strictEqual(result.valid, true);
  assert.strictEqual(result.issues.length, 1);
  assert.strictEqual(result.issues[0].type, 'unknown_parameter');
});

test('SchemaParser - should detect tool not found', () => {
  const parser = new SchemaParser();
  const schemaPath = path.join(EXAMPLES_DIR, 'schema.json');
  const schema = parser.parse(schemaPath);

  const result = parser.validateToolCall('non_existent_tool', {}, schema);

  assert.strictEqual(result.valid, false);
  assert.strictEqual(result.issues.length, 1);
  assert.strictEqual(result.issues[0].type, 'tool_not_found');
});

test('SchemaParser - should detect schema drift', () => {
  const parser = new SchemaParser();
  const oldSchemaPath = path.join(EXAMPLES_DIR, 'schema-old.json');
  const newSchemaPath = path.join(EXAMPLES_DIR, 'schema.json');

  const oldSchema = parser.parse(oldSchemaPath);
  const newSchema = parser.parse(newSchemaPath);

  const drift = parser.detectSchemaDrift(oldSchema, newSchema);

  assert.ok(drift);
  assert.strictEqual(drift.hasBreakingChanges, true);
  assert.strictEqual(drift.added.length, 2);
  assert.strictEqual(drift.removed.length, 0);
  assert.ok(drift.modified.length > 0);

  const addedTools = drift.added.map(a => a.tool);
  assert.ok(addedTools.includes('delete_user'));
  assert.ok(addedTools.includes('search_files'));
});

test('SchemaParser - should detect type mismatch', () => {
  const parser = new SchemaParser();
  const schemaPath = path.join(EXAMPLES_DIR, 'schema.json');
  const schema = parser.parse(schemaPath);

  const result = parser.validateToolCall('list_users', { page: 'not-a-number' }, schema);

  assert.strictEqual(result.valid, false);
  assert.ok(result.issues.some(i => i.type === 'type_mismatch'));
});

test('SchemaParser - should handle integer type compatibility', () => {
  const parser = new SchemaParser();
  const schemaPath = path.join(EXAMPLES_DIR, 'schema.json');
  const schema = parser.parse(schemaPath);

  const result = parser.validateToolCall('list_users', { page: 1 }, schema);

  assert.strictEqual(result.valid, true);
});
