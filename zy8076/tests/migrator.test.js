const SnapshotParser = require('../src/snapshot-parser');
const MigrationExecutor = require('../src/migration-executor');
const RuleValidator = require('../src/rule-validator');
const ReportExporter = require('../src/report-exporter');
const path = require('path');
const fs = require('fs');

const TEST_SNAPSHOTS_DIR = path.join(__dirname, 'test-snapshots');
const TEST_MIGRATIONS_DIR = path.join(__dirname, 'test-migrations');
const TEST_RULES_PATH = path.join(__dirname, 'test-rules.yaml');
const TEST_OUTPUT_DIR = path.join(__dirname, 'test-output');

function setupTestFiles() {
  if (!fs.existsSync(TEST_SNAPSHOTS_DIR)) {
    fs.mkdirSync(TEST_SNAPSHOTS_DIR, { recursive: true });
  }
  if (!fs.existsSync(TEST_MIGRATIONS_DIR)) {
    fs.mkdirSync(TEST_MIGRATIONS_DIR, { recursive: true });
  }

  fs.writeFileSync(path.join(TEST_SNAPSHOTS_DIR, 'v1_snapshot.json'), JSON.stringify({
    version: 1,
    data: { user: { id: 'user_001', name: 'Test' }, settings: { volume: 50 } },
    metadata: {}
  }));

  fs.writeFileSync(path.join(TEST_SNAPSHOTS_DIR, 'v2_snapshot.json'), JSON.stringify({
    version: 2,
    data: { user: { id: 'user_001', displayName: 'Test', avatar: null }, settings: { volume: 50, autoplay: true } },
    metadata: {}
  }));

  fs.writeFileSync(TEST_RULES_PATH, `
validations:
  - version: "*"
    field: user.id
    rules:
      - type: string
      - required: true
  - version: 2
    field: settings.volume
    rules:
      - type: number
      - min: 0
      - max: 100
`);

  fs.writeFileSync(path.join(TEST_MIGRATIONS_DIR, '2_add_fields.js'), `
module.exports = {
  up: async (data) => {
    if (data.user && !data.user.avatar) data.user.avatar = null;
    if (data.settings && !data.settings.autoplay) data.settings.autoplay = true;
    return data;
  },
  down: async (data) => {
    if (data.user) delete data.user.avatar;
    if (data.settings) delete data.settings.autoplay;
    return data;
  }
};
`);

  if (!fs.existsSync(TEST_OUTPUT_DIR)) {
    fs.mkdirSync(TEST_OUTPUT_DIR, { recursive: true });
  }
}

function cleanupTestFiles() {
  const dirs = [TEST_SNAPSHOTS_DIR, TEST_MIGRATIONS_DIR, TEST_OUTPUT_DIR];
  for (const dir of dirs) {
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true });
    }
  }
  const yamlPath = TEST_RULES_PATH;
  if (fs.existsSync(yamlPath)) {
    fs.unlinkSync(yamlPath);
  }
}

describe('SnapshotParser', () => {
  beforeAll(setupTestFiles);
  afterAll(cleanupTestFiles);

  test('loadAllSnapshots loads all snapshots from directory', () => {
    const parser = new SnapshotParser(TEST_SNAPSHOTS_DIR);
    const snapshots = parser.loadAllSnapshots();
    expect(Object.keys(snapshots).length).toBe(2);
    expect(snapshots[1]).toBeDefined();
    expect(snapshots[2]).toBeDefined();
  });

  test('detectVersionChain detects version chain correctly', () => {
    const parser = new SnapshotParser(TEST_SNAPSHOTS_DIR);
    const snapshots = parser.loadAllSnapshots();
    const { chain, missing } = parser.detectVersionChain(snapshots);
    expect(chain).toEqual([1, 2]);
    expect(missing).toEqual([]);
  });
});

describe('MigrationExecutor', () => {
  beforeAll(setupTestFiles);
  afterAll(cleanupTestFiles);

  test('loadMigrations loads all migrations', () => {
    const executor = new MigrationExecutor(TEST_MIGRATIONS_DIR);
    const versions = executor.getMigrationVersions();
    expect(versions).toContain(2);
  });

  test('executeMigration runs migration up correctly', async () => {
    const executor = new MigrationExecutor(TEST_MIGRATIONS_DIR);
    const data = { user: { id: 'test' }, settings: {} };
    const result = await executor.executeMigration(2, data);
    expect(result.success).toBe(true);
    expect(result.after.user.avatar).toBeNull();
    expect(result.after.settings.autoplay).toBe(true);
  });

  test('executeMigration triggers rollback on error', async () => {
    const badMigration = path.join(TEST_MIGRATIONS_DIR, '3_bad.js');
    fs.writeFileSync(badMigration, `
module.exports = {
  up: async (data) => { throw new Error('Migration failed'); },
  down: async (data) => data
};
`);

    const executor = new MigrationExecutor(TEST_MIGRATIONS_DIR);
    const data = { user: { id: 'test' } };
    const result = await executor.executeMigration(3, data);
    expect(result.success).toBe(false);
    expect(result.rollbackTriggered).toBe(true);

    fs.unlinkSync(badMigration);
  });
});

describe('RuleValidator', () => {
  beforeAll(setupTestFiles);
  afterAll(cleanupTestFiles);

  test('validate checks required fields', () => {
    const validator = new RuleValidator(TEST_RULES_PATH);
    const result = validator.validate({ user: { id: null } }, 1);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.rule === 'required')).toBe(true);
  });

  test('validate checks type constraints', () => {
    const validator = new RuleValidator(TEST_RULES_PATH);
    const result = validator.validate({ user: { id: 123 } }, 1);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.rule === 'type')).toBe(true);
  });

  test('computeDiff detects added, removed, modified fields', () => {
    const validator = new RuleValidator(TEST_RULES_PATH);
    const before = { user: { id: 'test', name: 'Old' } };
    const after = { user: { id: 'test', name: 'New', extra: 'Added' } };
    const diff = validator.computeDiff(before, after);

    const added = diff.filter(d => d.type === 'added');
    const modified = diff.filter(d => d.type === 'modified');

    expect(added.some(d => d.path === 'user.extra')).toBe(true);
    expect(modified.some(d => d.path === 'user.name')).toBe(true);
  });
});

describe('ReportExporter', () => {
  beforeAll(setupTestFiles);
  afterAll(cleanupTestFiles);

  test('export generates markdown and json files', () => {
    const exporter = new ReportExporter(TEST_OUTPUT_DIR);
    const report = {
      generatedAt: new Date().toISOString(),
      fromVersion: 1,
      toVersion: 2,
      success: true,
      totalSnapshots: 2,
      successful: 2,
      failed: 0,
      skippedVersions: [],
      totalSteps: 1,
      rollbacksTriggered: 0,
      versionChain: [1, 2],
      steps: [],
      rollbackSeeds: [],
      errors: []
    };

    const paths = exporter.export(report);

    expect(fs.existsSync(paths.reportPath)).toBe(true);
    expect(fs.existsSync(paths.summaryPath)).toBe(true);
    expect(fs.readFileSync(paths.reportPath, 'utf-8')).toContain('# Migration Report');
  });

  test('generateSummary creates correct summary structure', () => {
    const exporter = new ReportExporter(TEST_OUTPUT_DIR);
    const report = {
      generatedAt: new Date().toISOString(),
      fromVersion: 1,
      toVersion: 2,
      success: true,
      totalSnapshots: 2,
      successful: 2,
      failed: 0,
      skippedVersions: [5],
      totalSteps: 1,
      rollbacksTriggered: 0,
      versionChain: [1, 2],
      steps: [],
      rollbackSeeds: [],
      errors: []
    };

    const summary = exporter.generateSummary(report);
    expect(summary.success).toBe(true);
    expect(summary.skippedVersions).toContain(5);
  });
});
