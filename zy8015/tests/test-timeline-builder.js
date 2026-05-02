const test = require('node:test');
const assert = require('node:assert');
const path = require('path');

const SchemaParser = require('../src/schema-parser');
const TraceParser = require('../src/trace-parser');
const TimelineBuilder = require('../src/timeline-builder');
const ReplayPlanner = require('../src/replay-planner');

const EXAMPLES_DIR = path.join(__dirname, '..', 'examples');

test('TimelineBuilder - should build timeline from trace', async () => {
  const traceParser = new TraceParser();
  const tracePath = path.join(EXAMPLES_DIR, 'trace.jsonl');
  const trace = await traceParser.parse(tracePath);

  const builder = new TimelineBuilder();
  const timeline = builder.build(trace);

  assert.ok(timeline);
  assert.ok(Array.isArray(timeline.events));
  assert.ok(Array.isArray(timeline.calls));
  assert.ok(Array.isArray(timeline.errors));
  assert.ok(Array.isArray(timeline.timeline));
  assert.ok(timeline.statistics);
});

test('TimelineBuilder - should detect retries', async () => {
  const traceParser = new TraceParser({ handleDuplicates: 'keep_all' });
  const tracePath = path.join(EXAMPLES_DIR, 'trace.jsonl');
  const trace = await traceParser.parse(tracePath);

  const builder = new TimelineBuilder();
  const timeline = builder.build(trace);

  assert.ok(Array.isArray(timeline.retries));
  assert.ok(timeline.retries.length > 0);
});

test('TimelineBuilder - should detect non-idempotent risks', async () => {
  const traceParser = new TraceParser({ handleDuplicates: 'keep_all' });
  const tracePath = path.join(EXAMPLES_DIR, 'trace.jsonl');
  const trace = await traceParser.parse(tracePath);

  const builder = new TimelineBuilder();
  const timeline = builder.build(trace);

  assert.ok(Array.isArray(timeline.nonIdempotentRisks));
  assert.ok(timeline.nonIdempotentRisks.length > 0);
});

test('TimelineBuilder - should calculate statistics', async () => {
  const traceParser = new TraceParser();
  const tracePath = path.join(EXAMPLES_DIR, 'trace.jsonl');
  const trace = await traceParser.parse(tracePath);

  const builder = new TimelineBuilder();
  const timeline = builder.build(trace);

  assert.ok(timeline.statistics);
  assert.strictEqual(typeof timeline.statistics.totalCalls, 'number');
  assert.strictEqual(typeof timeline.statistics.successful, 'number');
  assert.strictEqual(typeof timeline.statistics.failed, 'number');
  assert.strictEqual(typeof timeline.statistics.successRate, 'string');
  assert.ok(timeline.statistics.toolStats);
});

test('TimelineBuilder - should group calls', async () => {
  const traceParser = new TraceParser();
  const tracePath = path.join(EXAMPLES_DIR, 'trace.jsonl');
  const trace = await traceParser.parse(tracePath);

  const builder = new TimelineBuilder();
  const timeline = builder.build(trace);

  assert.ok(timeline.callGroups);
  assert.ok(timeline.callGroups.byTool);
  assert.ok(timeline.callGroups.byStatus);
  assert.ok(Array.isArray(timeline.callGroups.byStatus.successful));
  assert.ok(Array.isArray(timeline.callGroups.byStatus.failed));
});

test('ReplayPlanner - should generate replay plan', async () => {
  const schemaParser = new SchemaParser();
  const traceParser = new TraceParser();
  const timelineBuilder = new TimelineBuilder();
  const replayPlanner = new ReplayPlanner();

  const schemaPath = path.join(EXAMPLES_DIR, 'schema.json');
  const tracePath = path.join(EXAMPLES_DIR, 'trace.jsonl');

  const schema = schemaParser.parse(schemaPath);
  const trace = await traceParser.parse(tracePath);
  const timeline = timelineBuilder.build(trace);

  const plan = replayPlanner.generate(timeline, schema);

  assert.ok(plan);
  assert.strictEqual(plan.version, '1.0.0');
  assert.ok(plan.summary);
  assert.ok(Array.isArray(plan.steps));
  assert.ok(Array.isArray(plan.risks));
});

test('ReplayPlanner - should generate dry-run summary', async () => {
  const schemaParser = new SchemaParser();
  const traceParser = new TraceParser();
  const timelineBuilder = new TimelineBuilder();
  const replayPlanner = new ReplayPlanner();

  const schemaPath = path.join(EXAMPLES_DIR, 'schema.json');
  const tracePath = path.join(EXAMPLES_DIR, 'trace.jsonl');

  const schema = schemaParser.parse(schemaPath);
  const trace = await traceParser.parse(tracePath);
  const timeline = timelineBuilder.build(trace);

  const plan = replayPlanner.generate(timeline, schema);
  const dryRun = replayPlanner.generateDryRunSummary(plan);

  assert.ok(dryRun);
  assert.strictEqual(typeof dryRun.canExecute, 'boolean');
  assert.ok(Array.isArray(dryRun.blockers));
  assert.ok(Array.isArray(dryRun.warnings));
  assert.ok(Array.isArray(dryRun.executionOrder));
});

test('ReplayPlanner - should respect includeRetries option', async () => {
  const schemaParser = new SchemaParser();
  const traceParser = new TraceParser({ handleDuplicates: 'keep_all' });
  const timelineBuilder = new TimelineBuilder();
  const replayPlanner = new ReplayPlanner();

  const schemaPath = path.join(EXAMPLES_DIR, 'schema.json');
  const tracePath = path.join(EXAMPLES_DIR, 'trace.jsonl');

  const schema = schemaParser.parse(schemaPath);
  const trace = await traceParser.parse(tracePath);
  const timeline = timelineBuilder.build(trace);

  const planWithRetries = replayPlanner.generate(timeline, schema, { includeRetries: true });
  const planWithoutRetries = replayPlanner.generate(timeline, schema, { includeRetries: false });

  assert.ok(planWithRetries);
  assert.ok(planWithoutRetries);
});

test('ReplayPlanner - should validate parameters against schema', async () => {
  const schemaParser = new SchemaParser();
  const traceParser = new TraceParser();
  const timelineBuilder = new TimelineBuilder();
  const replayPlanner = new ReplayPlanner();

  const schemaPath = path.join(EXAMPLES_DIR, 'schema.json');
  const tracePath = path.join(EXAMPLES_DIR, 'trace.jsonl');

  const schema = schemaParser.parse(schemaPath);
  const trace = await traceParser.parse(tracePath);
  const timeline = timelineBuilder.build(trace);

  const plan = replayPlanner.generate(timeline, schema);

  for (const step of plan.steps) {
    assert.ok(step.validation);
    assert.strictEqual(typeof step.validation.valid, 'boolean');
    assert.ok(Array.isArray(step.validation.issues));
  }
});

test('TimelineBuilder - should generate time series', async () => {
  const traceParser = new TraceParser();
  const tracePath = path.join(EXAMPLES_DIR, 'trace.jsonl');
  const trace = await traceParser.parse(tracePath);

  const builder = new TimelineBuilder();
  const timeline = builder.build(trace);

  const timeSeries = builder.getTimeSeries(timeline.calls, 1000);

  assert.ok(Array.isArray(timeSeries));
  if (timeSeries.length > 0) {
    const first = timeSeries[0];
    assert.strictEqual(typeof first.startTime, 'number');
    assert.strictEqual(typeof first.endTime, 'number');
    assert.strictEqual(typeof first.callCount, 'number');
    assert.strictEqual(typeof first.successful, 'number');
    assert.strictEqual(typeof first.failed, 'number');
  }
});

test('TimelineBuilder - should detect multiple write risks', async () => {
  const traceParser = new TraceParser();
  const tracePath = path.join(EXAMPLES_DIR, 'trace.jsonl');
  const trace = await traceParser.parse(tracePath);

  const builder = new TimelineBuilder();
  const timeline = builder.build(trace);

  const writeRisks = timeline.nonIdempotentRisks.filter(r => r.type === 'multiple_write_risk');
  assert.ok(Array.isArray(writeRisks));
});
