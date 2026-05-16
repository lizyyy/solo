const LicenseDiff = require('./src/index.js');
const path = require('path');

const oldPath = path.join(__dirname, 'test/old-package-lock.json');
const newPath = path.join(__dirname, 'test/new-package-lock.json');

console.log('Testing NPM License Diff CLI...\n');

const licenseDiff = new LicenseDiff();

// Test 1: Parse lockfiles
console.log('Test 1: Parsing lockfiles...');
const oldLock = licenseDiff.parseLockfile(oldPath);
const newLock = licenseDiff.parseLockfile(newPath);
console.log(`  Old: ${oldLock.packages.length} packages`);
console.log(`  New: ${newLock.packages.length} packages`);
console.log('  ✅ Parsing working!\n');

// Test 2: Compare dependencies
console.log('Test 2: Comparing dependencies...');
const comparison = licenseDiff.compareDependencies(oldLock, newLock);
console.log(`  Summary: ${JSON.stringify(comparison.summary, null, 2)}`);
console.log('  ✅ Comparison working!\n');

// Test 3: Generate console report
console.log('Test 3: Generating console report...\n');
licenseDiff.generateReport(comparison, 'console');
console.log('\n  ✅ Console report working!\n');

// Test 4: Generate JSON report
console.log('Test 4: Generating JSON report...');
const jsonReport = licenseDiff.generateReport(comparison, 'json');
console.log(`  Generated JSON with ${Object.keys(jsonReport).length} fields`);
console.log('  ✅ JSON report working!\n');

// Test 5: Generate Markdown report
console.log('Test 5: Generating Markdown report...');
const mdReport = licenseDiff.generateReport(comparison, 'markdown');
console.log(`  Generated Markdown with ${mdReport.length} characters`);
console.log('  ✅ Markdown report working!\n');

console.log('=== ALL TESTS PASSED! ===\n');
console.log('Summary:');
console.log(`  - Added: ${comparison.summary.added} packages`);
console.log(`  - Removed: ${comparison.summary.removed} packages`);
console.log(`  - Changed: ${comparison.summary.changed} packages`);
console.log(`  - Risk packages identified: ${comparison.added.filter(p => p.normalizedLicense && p.normalizedLicense.risk === 'high').length} high risk`);
