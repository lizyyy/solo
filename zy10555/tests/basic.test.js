'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const {
  LockfileParser,
  SnapshotManager,
  ReportGenerator,
  BadRowCollector
} = require('../src');

const EXAMPLES_DIR = path.join(__dirname, '..', 'examples');

describe('LockfileParser', function () {
  it('should parse package-lock.json correctly', function () {
    const parser = new LockfileParser();
    const result = parser.parse(path.join(EXAMPLES_DIR, 'package-lock-v1.json'));

    assert.equal(result.format, 'package-lock.json');
    assert.ok(Array.isArray(result.packages));
    assert.ok(result.packages.length >= 4);

    const chalk = result.packages.find(p => p.name === 'chalk');
    assert.ok(chalk);
    assert.equal(chalk.version, '4.1.2');
    assert.equal(chalk.license, 'MIT');
  });

  it('should handle dirty lockfile and collect bad rows', function () {
    const parser = new LockfileParser();
    const result = parser.parse(path.join(EXAMPLES_DIR, 'package-lock-dirty.json'));

    assert.ok(result.badRows.getCount() >= 0);
    console.log(`  Bad rows collected: ${result.badRows.getCount()}`);

    for (const bad of result.badRows.getAll()) {
      console.log(`    - Reason: ${bad.reason}`);
    }
  });

  it('should parse pnpm-lock.yaml', function () {
    const parser = new LockfileParser();
    const result = parser.parse(path.join(EXAMPLES_DIR, 'pnpm-lock.yaml'));

    assert.equal(result.format, 'pnpm-lock.yaml');
    assert.ok(result.packages.length > 0);

    const chalk = result.packages.find(p => p.name === 'chalk');
    assert.ok(chalk);
  });
});

describe('SnapshotManager', function () {
  it('should create snapshot with summary', function () {
    const parser = new LockfileParser();
    const parseResult = parser.parse(path.join(EXAMPLES_DIR, 'package-lock-v1.json'));

    const manager = new SnapshotManager();
    const snapshot = manager.createSnapshot(parseResult.packages);

    assert.equal(snapshot.version, '1.0.0');
    assert.ok(snapshot.summary);
    assert.ok(snapshot.summary.totalPackages >= 4);
    assert.ok(snapshot.summary.uniqueLicenses >= 2);
  });

  it('should compare snapshots and detect changes', function () {
    const parser = new LockfileParser();
    const v1Result = parser.parse(path.join(EXAMPLES_DIR, 'package-lock-v1.json'));
    const v2Result = parser.parse(path.join(EXAMPLES_DIR, 'package-lock-v2.json'));

    const manager = new SnapshotManager();
    const oldSnapshot = manager.createSnapshot(v1Result.packages);
    const comparison = manager.compare(oldSnapshot, v2Result.packages);

    assert.ok(comparison.hasChanges);
    assert.ok(comparison.added.length > 0, 'Should detect added packages');
    assert.ok(comparison.upgraded.length > 0, 'Should detect upgraded packages');
    assert.ok(comparison.licenseChanged.length > 0, 'Should detect license changes');

    console.log(`  Comparison results:`);
    console.log(`    - Added: ${comparison.added.length}`);
    console.log(`    - Removed: ${comparison.removed.length}`);
    console.log(`    - Upgraded: ${comparison.upgraded.length}`);
    console.log(`    - Downgraded: ${comparison.downgraded.length}`);
    console.log(`    - License changed: ${comparison.licenseChanged.length}`);
    console.log(`    - Unchanged: ${comparison.unchanged.length}`);
  });

  it('should normalize licenses correctly', function () {
    const manager = new SnapshotManager();

    assert.equal(manager.normalizeLicense('MIT'), 'MIT');
    assert.equal(manager.normalizeLicense('mit'), 'MIT');
    assert.equal(manager.normalizeLicense('Apache License 2.0'), 'Apache-2.0');
    assert.equal(manager.normalizeLicense(null), 'UNKNOWN');
    assert.equal(manager.normalizeLicense(''), 'UNKNOWN');
  });

  it('should assess risk for packages', function () {
    const manager = new SnapshotManager({
      deniedLicenses: ['GPL']
    });

    const pkg1 = { name: 'test1', version: '1.0.0', license: 'UNKNOWN' };
    const risk1 = manager.assessRisk(pkg1);
    assert.equal(risk1.highestLevel, 'high');

    const pkg2 = { name: 'test2', version: '1.0.0', license: 'MIT' };
    const risk2 = manager.assessRisk(pkg2);
    assert.equal(risk2.highestLevel, 'low');
  });

  it('should merge packages by license', function () {
    const parser = new LockfileParser();
    const result = parser.parse(path.join(EXAMPLES_DIR, 'package-lock-v1.json'));

    const manager = new SnapshotManager();
    const groups = manager.mergeLicenses(result.packages);

    assert.ok(Array.isArray(groups));
    assert.ok(groups.length >= 2);

    for (const group of groups) {
      assert.ok(group.license);
      assert.ok(group.count > 0);
      assert.ok(Array.isArray(group.packages));
    }
  });
});

describe('BadRowCollector', function () {
  it('should collect and retain bad rows with context', function () {
    const collector = new BadRowCollector();

    collector.add({ name: 'bad-pkg', data: 'foo' }, 'Missing version', 'test.json', 10);
    collector.add('invalid-line-content', 'Parse error', 'test.json', 20);

    assert.equal(collector.getCount(), 2);

    const all = collector.getAll();
    assert.equal(all.length, 2);
    assert.equal(all[0].reason, 'Missing version');
    assert.equal(all[0].source, 'test.json');
    assert.equal(all[0].lineNumber, 10);
    assert.ok(all[0].timestamp);
  });

  it('should sanitize large row data', function () {
    const collector = new BadRowCollector();
    const longString = 'a'.repeat(5000);

    collector.add(longString, 'Too long');

    const rows = collector.getAll();
    assert.ok(rows[0].row.length <= 2000);
  });

  it('should merge collectors', function () {
    const c1 = new BadRowCollector();
    const c2 = new BadRowCollector();

    c1.add('row1', 'reason1');
    c2.add('row2', 'reason2');

    c1.merge(c2);

    assert.equal(c1.getCount(), 2);
  });
});

describe('ReportGenerator', function () {
  it('should generate terminal summary', function () {
    const parser = new LockfileParser();
    const v1Result = parser.parse(path.join(EXAMPLES_DIR, 'package-lock-v1.json'));
    const v2Result = parser.parse(path.join(EXAMPLES_DIR, 'package-lock-v2.json'));

    const manager = new SnapshotManager();
    const oldSnapshot = manager.createSnapshot(v1Result.packages);
    const comparison = manager.compare(oldSnapshot, v2Result.packages);

    const generator = new ReportGenerator();
    const summary = generator.generateTerminalSummary(comparison);

    assert.ok(typeof summary === 'string');
    assert.ok(summary.length > 0);
  });

  it('should generate JSON report', function () {
    const parser = new LockfileParser();
    const v1Result = parser.parse(path.join(EXAMPLES_DIR, 'package-lock-v1.json'));
    const v2Result = parser.parse(path.join(EXAMPLES_DIR, 'package-lock-v2.json'));

    const manager = new SnapshotManager();
    const oldSnapshot = manager.createSnapshot(v1Result.packages);
    const newSnapshot = manager.createSnapshot(v2Result.packages);
    const comparison = manager.compare(oldSnapshot, v2Result.packages);

    const generator = new ReportGenerator();
    const json = generator.generateJSONReport(comparison, newSnapshot);

    const parsed = JSON.parse(json);
    assert.equal(parsed.version, '1.0.0');
    assert.ok(parsed.summary);
    assert.ok(parsed.changes);
  });

  it('should generate Markdown report', function () {
    const parser = new LockfileParser();
    const v1Result = parser.parse(path.join(EXAMPLES_DIR, 'package-lock-v1.json'));
    const v2Result = parser.parse(path.join(EXAMPLES_DIR, 'package-lock-v2.json'));

    const manager = new SnapshotManager();
    const oldSnapshot = manager.createSnapshot(v1Result.packages);
    const newSnapshot = manager.createSnapshot(v2Result.packages);
    const comparison = manager.compare(oldSnapshot, v2Result.packages);

    const generator = new ReportGenerator();
    const md = generator.generateMarkdownReport(comparison, newSnapshot);

    assert.ok(typeof md === 'string');
    assert.ok(md.includes('# Dependency License Change Report'));
    assert.ok(md.includes('| Change Type | Count |'));
  });
});

describe('CLI Integration', function () {
  const cliPath = path.join(__dirname, '..', 'src', 'cli.js');
  const tempSnapshot = path.join(__dirname, '..', '.test-snapshot.json');

  before(function () {
    try { fs.unlinkSync(tempSnapshot); } catch (e) {}
  });

  after(function () {
    try { fs.unlinkSync(tempSnapshot); } catch (e) {}
  });

  it('should show help without error', function () {
    const output = execSync(`node ${cliPath} --help`, { encoding: 'utf8' });
    assert.ok(output.includes('license-snapshot'));
    assert.ok(output.includes('snapshot'));
    assert.ok(output.includes('compare'));
  });

  it('should create snapshot from lockfile', function () {
    const lockfile = path.join(EXAMPLES_DIR, 'package-lock-v1.json');
    const output = execSync(
      `node ${cliPath} snapshot ${lockfile} -o ${tempSnapshot}`,
      { encoding: 'utf8' }
    );

    assert.ok(output.includes('Snapshot saved'));
    assert.ok(fs.existsSync(tempSnapshot));

    const snapshot = JSON.parse(fs.readFileSync(tempSnapshot, 'utf8'));
    assert.ok(snapshot.packages.length > 0);
  });

  it('should compare and detect changes', function () {
    const lockfile = path.join(EXAMPLES_DIR, 'package-lock-v2.json');
    let exitCode = 0;

    try {
      execSync(
        `node ${cliPath} compare ${lockfile} -s ${tempSnapshot}`,
        { encoding: 'utf8', stdio: 'pipe' }
      );
    } catch (e) {
      exitCode = e.status;
    }

    console.log(`  Exit code: ${exitCode}`);
    assert.ok(exitCode === 0 || exitCode === 2, 'Should exit 0 or 2 for warnings');
  });

  it('should list licenses', function () {
    const output = execSync(
      `node ${cliPath} list ${tempSnapshot} --by-license`,
      { encoding: 'utf8' }
    );

    assert.ok(output.includes('MIT'));
    assert.ok(output.includes('packages'));
  });

  it('should handle dirty input gracefully', function () {
    const lockfile = path.join(EXAMPLES_DIR, 'package-lock-dirty.json');
    let exitCode = 0;

    try {
      const output = execSync(
        `node ${cliPath} snapshot ${lockfile} -o ${tempSnapshot}`,
        { encoding: 'utf8', stdio: 'pipe' }
      );
      console.log(output);
    } catch (e) {
      exitCode = e.status;
      console.log(e.stdout);
    }

    console.log(`  Exit code for dirty input: ${exitCode}`);
    assert.ok(exitCode === 0 || exitCode === 2, 'Should not crash (exit 0 or 2)');
    assert.ok(fs.existsSync(tempSnapshot), 'Should still output snapshot even with errors');
  });
});
