#!/usr/bin/env node

const path = require('path');
const fs = require('fs');

console.log('=== SQL Migration Shadow Replay - Configuration Test ===');
console.log('');

// Check example directory structure
console.log('Checking example directory...');
const exampleDir = path.join(__dirname, 'example');

const requiredPaths = [
  'db-config.json',
  'migrations/001_create_users.sql',
  'shadow-data/users.json',
  'shadow-data/orders.json',
  'schemas/users.json',
  'schemas/orders.json'
];

let allFound = true;
for (const p of requiredPaths) {
  const fullPath = path.join(exampleDir, p);
  const exists = fs.existsSync(fullPath);
  console.log(`  ${p}: ${exists ? '✓ FOUND' : '✗ MISSING'}`);
  if (!exists) allFound = false;
}

console.log('');

if (allFound) {
  console.log('✓ All configuration files present!');
  console.log('');
  console.log('Example usage:');
  console.log('  node dist/cli.js run \\');
  console.log('    -m example/migrations \\');
  console.log('    -d example/shadow-data \\');
  console.log('    -s example/schemas \\');
  console.log('    -c example/db-config.json \\');
  console.log('    -o output');
  console.log('');
  console.log('Note: Make sure your MySQL database is configured and running.');
  console.log('      Update example/db-config.json with your credentials.');
} else {
  console.log('✗ Some configuration files missing!');
  process.exit(1);
}
