#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const { EXIT_CODES } = require('../src/constants');
const { parseICSFile } = require('../src/ics-parser');
const { normalizeTimezone } = require('../src/time-utils');

const TEST_DIR = __dirname;
const OUTPUT_DIR = path.join(TEST_DIR, 'test-output');

let passed = 0;
let failed = 0;

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function runTest(name, testFn) {
  try {
    process.stdout.write(`  ${name}... `);
    testFn();
    console.log('✅ PASS');
    passed++;
  } catch (error) {
    console.log('❌ FAIL');
    console.log(`     Error: ${error.message}`);
    failed++;
  }
}

function assertEqual(actual, expected, message = '') {
  if (actual !== expected) {
    throw new Error(`${message} Expected: ${expected}, Got: ${actual}`);
  }
}

function assertTrue(condition, message = 'Assertion failed') {
  if (!condition) {
    throw new Error(message);
  }
}

console.log('\n========================================');
console.log('  iCal Meeting Conflict CLI Test Suite');
console.log('========================================\n');

ensureDir(OUTPUT_DIR);

console.log('1. Timezone Normalization Tests');
runTest('America/New_York should normalize correctly', () => {
  const result = normalizeTimezone('America/New_York');
  assertEqual(result, 'America/New_York');
});

runTest('Asia/Shanghai should normalize correctly', () => {
  const result = normalizeTimezone('Asia/Shanghai');
  assertEqual(result, 'Asia/Shanghai');
});

runTest('UTC should normalize correctly', () => {
  const result = normalizeTimezone('UTC');
  assertEqual(result, 'UTC');
});

runTest('EST should map to America/New_York', () => {
  const result = normalizeTimezone('EST');
  assertEqual(result, 'America/New_York');
});

runTest('Invalid timezone should default to UTC', () => {
  const result = normalizeTimezone('Invalid/Timezone');
  assertEqual(result, 'UTC');
});

console.log('\n2. ICS Parsing Tests');

runTest('Clean calendar should parse successfully', () => {
  const result = parseICSFile(path.join(TEST_DIR, 'clean-calendar.ics'));
  assertTrue(result.events.length > 0, 'No events parsed');
  assertEqual(result.events.length, 5);
});

runTest('Dirty calendar should parse successfully', () => {
  const result = parseICSFile(path.join(TEST_DIR, 'dirty-calendar.ics'));
  assertTrue(result.events.length > 0, 'No events parsed');
  assertEqual(result.events.length, 12);
});

runTest('New York time should convert correctly to UTC', () => {
  const result = parseICSFile(path.join(TEST_DIR, 'dirty-calendar.ics'));
  const nyEvent = result.events.find(e => e.summary.includes('纽约'));
  assertTrue(nyEvent, 'NY event not found');
  const hour = nyEvent.startTime.hour;
  assertEqual(hour, 13);
});

runTest('Shanghai time should convert correctly to UTC', () => {
  const result = parseICSFile(path.join(TEST_DIR, 'dirty-calendar.ics'));
  const shEvent = result.events.find(e => e.summary.includes('上海') && e.summary.includes('时区'));
  assertTrue(shEvent, 'Shanghai event not found');
  const hour = shEvent.startTime.hour;
  assertEqual(hour, 13);
});

runTest('NY and Shanghai meetings should be same UTC time', () => {
  const result = parseICSFile(path.join(TEST_DIR, 'dirty-calendar.ics'));
  const nyEvent = result.events.find(e => e.summary.includes('纽约'));
  const shEvent = result.events.find(e => e.summary.includes('上海') && e.summary.includes('时区'));
  assertTrue(nyEvent && shEvent, 'Events not found');
  assertEqual(nyEvent.startTime.toMillis(), shEvent.startTime.toMillis(), 'Start times should match');
  assertEqual(nyEvent.endTime.toMillis(), shEvent.endTime.toMillis(), 'End times should match');
});

console.log('\n3. CLI Integration Tests');

runTest('CLI help should exit with code 0', () => {
  try {
    execSync('node src/cli.js --help', { stdio: 'pipe' });
  } catch (error) {
    throw new Error('CLI help failed');
  }
});

runTest('CLI validate should work with clean calendar', () => {
  try {
    execSync('node src/cli.js validate tests/clean-calendar.ics', { stdio: 'pipe' });
  } catch (error) {
    throw new Error('CLI validate failed');
  }
});

runTest('CLI list-rooms should work', () => {
  try {
    execSync('node src/cli.js list-rooms tests/clean-calendar.ics', { stdio: 'pipe' });
  } catch (error) {
    throw new Error('CLI list-rooms failed');
  }
});

runTest('Clean calendar should have 0 conflicts and exit 0', () => {
  const outputDir = path.join(OUTPUT_DIR, 'clean');
  ensureDir(outputDir);
  
  try {
    execSync(`node src/cli.js tests/clean-calendar.ics -o ${outputDir} -s 2026-06-01 -e 2026-06-07 -n clean -q`, { stdio: 'pipe' });
  } catch (error) {
    if (error.status !== 0) {
      throw new Error(`Expected exit code 0, got ${error.status}`);
    }
  }
  
  const jsonPath = path.join(outputDir, 'clean.json');
  assertTrue(fs.existsSync(jsonPath), 'JSON report not generated');
  
  const report = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
  assertEqual(report.summary.totalConflicts, 0, 'Should have 0 conflicts');
  assertEqual(report.exitCode, 0, 'Exit code should be 0');
});

runTest('Dirty calendar should have conflicts and exit 1 with --strict', () => {
  const outputDir = path.join(OUTPUT_DIR, 'dirty');
  ensureDir(outputDir);
  
  let exitCode = 0;
  try {
    execSync(`node src/cli.js tests/dirty-calendar.ics -o ${outputDir} -s 2026-06-01 -e 2026-06-15 -n dirty -q --strict`, { stdio: 'pipe' });
  } catch (error) {
    exitCode = error.status;
  }
  
  assertEqual(exitCode, EXIT_CODES.CONFLICTS_FOUND, `Expected exit code 1, got ${exitCode}`);
  
  const jsonPath = path.join(outputDir, 'dirty.json');
  assertTrue(fs.existsSync(jsonPath), 'JSON report not generated');
  
  const report = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
  assertTrue(report.summary.totalConflicts > 0, 'Should have conflicts');
  assertEqual(report.exitCode, EXIT_CODES.CONFLICTS_FOUND, 'Exit code should be 1');
});

runTest('Virtual room timezone conflict should be detected', () => {
  const outputDir = path.join(OUTPUT_DIR, 'dirty2');
  ensureDir(outputDir);
  
  try {
    execSync(`node src/cli.js tests/dirty-calendar.ics -o ${outputDir} -s 2026-06-01 -e 2026-06-15 -n dirty -q`, { stdio: 'pipe' });
  } catch (error) {}
  
  const jsonPath = path.join(outputDir, 'dirty.json');
  const report = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
  
  const virtualRoom = report.byRoom['虚拟会议室'];
  assertTrue(virtualRoom, 'Virtual room data not found');
  assertTrue(virtualRoom.hasConflicts, 'Virtual room should have conflicts');
  assertTrue(virtualRoom.conflictCount > 0, 'Virtual room should have > 0 conflicts');
});

runTest('JSON and Markdown reports should be consistent', () => {
  const outputDir = path.join(OUTPUT_DIR, 'consistency');
  ensureDir(outputDir);
  
  try {
    execSync(`node src/cli.js tests/dirty-calendar.ics -o ${outputDir} -s 2026-06-01 -e 2026-06-15 -n report -q`, { stdio: 'pipe' });
  } catch (error) {}
  
  const jsonPath = path.join(outputDir, 'report.json');
  const mdPath = path.join(outputDir, 'report.md');
  
  assertTrue(fs.existsSync(jsonPath), 'JSON report not generated');
  assertTrue(fs.existsSync(mdPath), 'Markdown report not generated');
  
  const jsonReport = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
  const mdContent = fs.readFileSync(mdPath, 'utf-8');
  
  const totalConflicts = jsonReport.summary.totalConflicts;
  assertTrue(mdContent.includes(`发现冲突数 | ${totalConflicts}`), 
    `Markdown should mention ${totalConflicts} conflicts`);
  
  const cancelNotEffective = jsonReport.summary.cancelNotEffective;
  assertTrue(mdContent.includes(`取消未生效 | ${cancelNotEffective}`),
    `Markdown should mention ${cancelNotEffective} cancellations`);
});

console.log('\n4. Cancellation Handling Tests');

runTest('Dirty calendar should have cancellation issues', () => {
  const outputDir = path.join(OUTPUT_DIR, 'cancel');
  ensureDir(outputDir);
  
  try {
    execSync(`node src/cli.js tests/dirty-calendar.ics -o ${outputDir} -s 2026-06-01 -e 2026-06-15 -n cancel -q`, { stdio: 'pipe' });
  } catch (error) {}
  
  const jsonPath = path.join(outputDir, 'cancel.json');
  const report = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
  
  assertTrue(report.summary.cancelNotEffective > 0, 'Should have cancellation issues');
  assertTrue(report.cancellations.cancelNotEffective.length > 0, 'Should have cancellation details');
});

console.log('\n========================================');
console.log(`  Test Results: ${passed} passed, ${failed} failed`);
console.log('========================================\n');

if (failed > 0) {
  process.exit(1);
} else {
  console.log('✅ All tests passed!\n');
  process.exit(0);
}
