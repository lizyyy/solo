require('dotenv').config();

const fs = require('fs');
const path = require('path');

console.log('=== Warehouse Inventory System Setup Verification ===\n');

let allPassed = true;

function check(message, condition, details = '') {
  const status = condition ? '✓ PASS' : '✗ FAIL';
  console.log(`${status}: ${message}`);
  if (details && !condition) {
    console.log(`   ${details}`);
  }
  if (!condition) {
    allPassed = false;
  }
}

console.log('1. Checking directory structure...');
check('Project root exists', fs.existsSync(path.join(__dirname, '..')));
check('server directory exists', fs.existsSync(path.join(__dirname, '../server')));
check('public directory exists', fs.existsSync(path.join(__dirname, '../public')));
check('scripts directory exists', fs.existsSync(path.join(__dirname, '../scripts')));
check('logs directory exists', fs.existsSync(path.join(__dirname, '../logs')));
console.log();

console.log('2. Checking critical files...');
check('package.json exists', fs.existsSync(path.join(__dirname, '../package.json')));
check('.env exists', fs.existsSync(path.join(__dirname, '../.env')));
check('.env.example exists', fs.existsSync(path.join(__dirname, '../.env.example')));
check('server/index.js exists', fs.existsSync(path.join(__dirname, '../server/index.js')));
check('server/routes/inventoryRoutes.js exists', 
  fs.existsSync(path.join(__dirname, '../server/routes/inventoryRoutes.js')));
check('public/index.html exists', fs.existsSync(path.join(__dirname, '../public/index.html')));
console.log();

console.log('3. Checking dependencies...');
try {
  require('dotenv');
  check('dotenv is available', true);
} catch (e) {
  check('dotenv is available', false, e.message);
}

try {
  require('express');
  check('express is available', true);
} catch (e) {
  check('express is available', false, e.message);
}

try {
  require('pg');
  check('pg (PostgreSQL) is available', true);
} catch (e) {
  check('pg (PostgreSQL) is available', false, e.message);
}

try {
  require('ioredis');
  check('ioredis is available', true);
} catch (e) {
  check('ioredis is available', false, e.message);
}

try {
  require('bcryptjs');
  check('bcryptjs is available', true);
} catch (e) {
  check('bcryptjs is available', false, e.message);
}

try {
  require('jsonwebtoken');
  check('jsonwebtoken is available', true);
} catch (e) {
  check('jsonwebtoken is available', false, e.message);
}

try {
  require('exceljs');
  check('exceljs is available', true);
} catch (e) {
  check('exceljs is available', false, e.message);
}

try {
  require('pdfkit');
  check('pdfkit is available', true);
} catch (e) {
  check('pdfkit is available', false, e.message);
}

try {
  require('jest');
  check('jest is available', true);
} catch (e) {
  check('jest is available', false, e.message);
}
console.log();

console.log('4. Checking code imports...');
const inventoryRoutesPath = path.join(__dirname, '../server/routes/inventoryRoutes.js');
const routesContent = fs.readFileSync(inventoryRoutesPath, 'utf8');
check('inventoryRoutes.js imports db', routesContent.includes("const db = require('../config/database')"));

const serverIndexPath = path.join(__dirname, '../server/index.js');
const serverContent = fs.readFileSync(serverIndexPath, 'utf8');
check('server/index.js imports path', serverContent.includes("const path = require('path')"));
check('server/index.js has static file middleware', serverContent.includes('express.static'));
console.log();

console.log('5. Checking configuration...');
const envContent = fs.readFileSync(path.join(__dirname, '../.env'), 'utf8');
check('.env has DB_HOST', envContent.includes('DB_HOST='));
check('.env has JWT_SECRET', envContent.includes('JWT_SECRET='));
console.log();

console.log('6. Checking npm scripts...');
const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));
check('has start script', !!packageJson.scripts.start);
check('has test script', !!packageJson.scripts.test);
check('has db:init script', !!packageJson.scripts['db:init']);
console.log();

console.log('=== Summary ===');
if (allPassed) {
  console.log('\n✓ All checks passed! System is ready to use.');
  console.log('\nNext steps:');
  console.log('  1. Ensure PostgreSQL and Redis are running');
  console.log('  2. Run: npm run db:init  (to initialize database)');
  console.log('  3. Run: npm start        (to start the server)');
  console.log('  4. Open: http://localhost:3000');
} else {
  console.log('\n✗ Some checks failed. Please review the issues above.');
  process.exit(1);
}
