const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');

const TraceParser = require('../src/trace-parser');

const EXAMPLES_DIR = path.join(__dirname, '..', 'examples');

test('TraceParser - should parse JSONL trace file', async () => {
  const parser = new TraceParser();
  const tracePath = path.join(EXAMPLES_DIR, 'trace.jsonl');
  const trace = await parser.parse(tracePath);

  assert.ok(trace);
  assert.ok(trace.totalEntries > 0);
  assert.ok(trace.toolCalls > 0);
  assert.ok(Array.isArray(trace.entries));
  assert.strictEqual(trace.filePath, tracePath);
});

test('TraceParser - should detect duplicate tool_call_id', async () => {
  const parser = new TraceParser({ handleDuplicates: 'keep_all' });
  const tracePath = path.join(EXAMPLES_DIR, 'trace.jsonl');
  const trace = await parser.parse(tracePath);

  assert.ok(Array.isArray(trace.duplicates));
  const hasDuplicates = trace.duplicates.length > 0;
  assert.ok(hasDuplicates);

  const tc008Duplicate = trace.duplicates.find(d => d.tool_call_id === 'tc-008');
  assert.ok(tc008Duplicate);
});

test('TraceParser - should handle duplicate tool_call_id with keep_first', async () => {
  const parser = new TraceParser({ handleDuplicates: 'keep_first' });
  const tracePath = path.join(EXAMPLES_DIR, 'trace.jsonl');
  const trace = await parser.parse(tracePath);

  const tc008Entries = trace.entries.filter(e => e.tool_call_id === 'tc-008');
  assert.strictEqual(tc008Entries.length, 1);
});

test('TraceParser - should handle duplicate tool_call_id with keep_last', async () => {
  const parser = new TraceParser({ handleDuplicates: 'keep_last' });
  const tracePath = path.join(EXAMPLES_DIR, 'trace.jsonl');
  const trace = await parser.parse(tracePath);

  const tc008Entries = trace.entries.filter(e => e.tool_call_id === 'tc-008');
  assert.strictEqual(tc008Entries.length, 1);
});

test('TraceParser - should handle duplicate tool_call_id with keep_all', async () => {
  const parser = new TraceParser({ handleDuplicates: 'keep_all' });
  const tracePath = path.join(EXAMPLES_DIR, 'trace.jsonl');
  const trace = await parser.parse(tracePath);

  const tc008Entries = trace.entries.filter(e => e.tool_call_id === 'tc-008');
  assert.ok(tc008Entries.length >= 2);
});

test('TraceParser - should normalize entry properties', async () => {
  const parser = new TraceParser();
  const tracePath = path.join(EXAMPLES_DIR, 'trace.jsonl');
  const trace = await parser.parse(tracePath);

  const entry = trace.entries[0];
  assert.ok(entry.id);
  assert.ok(entry.tool_call_id !== undefined);
  assert.ok(entry.type);
  assert.ok(entry.tool_name);
  assert.ok(entry.parameters);
  assert.ok(entry.success !== undefined);
});

test('TraceParser - should parse timestamp correctly', async () => {
  const parser = new TraceParser();
  const tracePath = path.join(EXAMPLES_DIR, 'trace.jsonl');
  const trace = await parser.parse(tracePath);

  const entry = trace.entries[0];
  assert.ok(entry.timestamp instanceof Date);
  assert.ok(!isNaN(entry.timestamp.getTime()));
});

test('TraceParser - should parse JSON array trace file', async () => {
  const parser = new TraceParser();
  const jsonContent = [
    {
      id: 'test-1',
      tool_call_id: 'tc-test-1',
      type: 'tool_call',
      timestamp: '2026-05-01T10:00:00.000Z',
      tool_name: 'test_tool',
      parameters: { param: 'value' },
      success: true
    }
  ];

  const tempPath = path.join(__dirname, 'temp-trace.json');
  fs.writeFileSync(tempPath, JSON.stringify(jsonContent));

  try {
    const trace = await parser.parse(tempPath);
    assert.ok(trace);
    assert.strictEqual(trace.totalEntries, 1);
    assert.strictEqual(trace.entries[0].tool_name, 'test_tool');
  } finally {
    fs.unlinkSync(tempPath);
  }
});

test('TraceParser - should calculate metadata', async () => {
  const parser = new TraceParser();
  const tracePath = path.join(EXAMPLES_DIR, 'trace.jsonl');
  const trace = await parser.parse(tracePath);

  assert.ok(trace.metadata);
  assert.ok(trace.metadata.startTime instanceof Date);
  assert.ok(trace.metadata.endTime instanceof Date);
  assert.strictEqual(typeof trace.metadata.duration_ms, 'number');
  assert.ok(trace.metadata.duration_ms >= 0);
});

test('TraceParser - should filter by result', async () => {
  const parser = new TraceParser();
  const tracePath = path.join(EXAMPLES_DIR, 'trace.jsonl');
  const trace = await parser.parse(tracePath);

  const successful = parser.filterByResult(trace.entries, true);
  const failed = parser.filterByResult(trace.entries, false);

  assert.ok(successful.length > 0);
  assert.ok(failed.length > 0);
  assert.ok(successful.every(e => e.success === true));
  assert.ok(failed.every(e => e.success === false));
});

test('TraceParser - should group by tool', async () => {
  const parser = new TraceParser();
  const tracePath = path.join(EXAMPLES_DIR, 'trace.jsonl');
  const trace = await parser.parse(tracePath);

  const groups = parser.groupByTool(trace.entries);

  assert.ok(Object.keys(groups).length > 0);
  assert.ok(groups.get_user);
  assert.ok(Array.isArray(groups.get_user));
});
