require('dotenv').config();

const fs = require('fs');
const path = require('path');

console.log('=== Chain Store Expiry Transfer System Setup Verification ===\n');

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
check('server/database directory exists', fs.existsSync(path.join(__dirname, '../server/database')));
check('server/services directory exists', fs.existsSync(path.join(__dirname, '../server/services')));
check('server/routes directory exists', fs.existsSync(path.join(__dirname, '../server/routes')));
check('public directory exists', fs.existsSync(path.join(__dirname, '../public')));
check('public/js directory exists', fs.existsSync(path.join(__dirname, '../public/js')));
check('public/css directory exists', fs.existsSync(path.join(__dirname, '../public/css')));
check('scripts directory exists', fs.existsSync(path.join(__dirname, '../scripts')));
check('logs directory exists', fs.existsSync(path.join(__dirname, '../logs')));
console.log();

console.log('2. Checking critical backend files...');
check('package.json exists', fs.existsSync(path.join(__dirname, '../package.json')));
check('.env exists', fs.existsSync(path.join(__dirname, '../.env')));
check('.env.example exists', fs.existsSync(path.join(__dirname, '../.env.example')));
check('server/index.js exists', fs.existsSync(path.join(__dirname, '../server/index.js')));
check('server/database/schema.sql exists', fs.existsSync(path.join(__dirname, '../server/database/schema.sql')));
check('scripts/init-db.js exists', fs.existsSync(path.join(__dirname, '../scripts/init-db.js')));
console.log();

console.log('3. Checking core service files (Store Transfer System)...');
check('storeService.js exists', fs.existsSync(path.join(__dirname, '../server/services/storeService.js')));
check('productService.js exists', fs.existsSync(path.join(__dirname, '../server/services/productService.js')));
check('batchService.js exists', fs.existsSync(path.join(__dirname, '../server/services/batchService.js')));
check('transferService.js exists', fs.existsSync(path.join(__dirname, '../server/services/transferService.js')));
check('damageService.js exists', fs.existsSync(path.join(__dirname, '../server/services/damageService.js')));
check('discountService.js exists', fs.existsSync(path.join(__dirname, '../server/services/discountService.js')));
check('rollbackService.js exists', fs.existsSync(path.join(__dirname, '../server/services/rollbackService.js')));
console.log();

console.log('4. Checking API route files...');
check('storeRoutes.js exists', fs.existsSync(path.join(__dirname, '../server/routes/storeRoutes.js')));
check('productRoutes.js exists', fs.existsSync(path.join(__dirname, '../server/routes/productRoutes.js')));
check('batchRoutes.js exists', fs.existsSync(path.join(__dirname, '../server/routes/batchRoutes.js')));
check('transferRoutes.js exists', fs.existsSync(path.join(__dirname, '../server/routes/transferRoutes.js')));
check('damageRoutes.js exists', fs.existsSync(path.join(__dirname, '../server/routes/damageRoutes.js')));
check('discountRoutes.js exists', fs.existsSync(path.join(__dirname, '../server/routes/discountRoutes.js')));
check('inventoryRoutes.js exists', fs.existsSync(path.join(__dirname, '../server/routes/inventoryRoutes.js')));
check('authRoutes.js exists', fs.existsSync(path.join(__dirname, '../server/routes/authRoutes.js')));
console.log();

console.log('5. Checking frontend files...');
check('public/index.html exists', fs.existsSync(path.join(__dirname, '../public/index.html')));
check('public/js/app.js exists', fs.existsSync(path.join(__dirname, '../public/js/app.js')));
check('public/js/offlineManager.js exists', fs.existsSync(path.join(__dirname, '../public/js/offlineManager.js')));
check('public/css/style.css exists', fs.existsSync(path.join(__dirname, '../public/css/style.css')));
console.log();

console.log('6. Checking core database schema...');
const schemaPath = path.join(__dirname, '../server/database/schema.sql');
const schemaContent = fs.readFileSync(schemaPath, 'utf8');
check('schema has stores table', schemaContent.includes('CREATE TABLE IF NOT EXISTS stores'));
check('schema has products table', schemaContent.includes('CREATE TABLE IF NOT EXISTS products'));
check('schema has inventory_batches table', schemaContent.includes('CREATE TABLE IF NOT EXISTS inventory_batches'));
check('schema has store_inventory table', schemaContent.includes('CREATE TABLE IF NOT EXISTS store_inventory'));
check('schema has transfer_orders table', schemaContent.includes('CREATE TABLE IF NOT EXISTS transfer_orders'));
check('schema has transfer_order_items table', schemaContent.includes('CREATE TABLE IF NOT EXISTS transfer_order_items'));
check('schema has stock_locks table', schemaContent.includes('CREATE TABLE IF NOT EXISTS stock_locks'));
check('schema has damage_reports table', schemaContent.includes('CREATE TABLE IF NOT EXISTS damage_reports'));
check('schema has damage_report_items table', schemaContent.includes('CREATE TABLE IF NOT EXISTS damage_report_items'));
check('schema has discount_sales table', schemaContent.includes('CREATE TABLE IF NOT EXISTS discount_sales'));
check('schema has discount_sale_items table', schemaContent.includes('CREATE TABLE IF NOT EXISTS discount_sale_items'));
check('schema has operation_logs table', schemaContent.includes('CREATE TABLE IF NOT EXISTS operation_logs'));
check('schema has users table', schemaContent.includes('CREATE TABLE IF NOT EXISTS users'));
console.log();

console.log('7. Checking database features...');
check('schema has expiry status trigger', schemaContent.includes('update_batch_status'));
check('schema supports batch expiry dates', schemaContent.includes('expiry_date'));
check('schema supports production dates', schemaContent.includes('production_date'));
check('schema has expiring_soon_quantity', schemaContent.includes('expiring_soon_quantity'));
check('schema has expired_quantity', schemaContent.includes('expired_quantity'));
check('schema has transfer approval statuses', schemaContent.includes('\'draft\''));
check('schema has damage approval process', schemaContent.includes('approved_status'));
check('schema has discount types', schemaContent.includes('discount_type'));
check('schema has stock lock mechanism', schemaContent.includes('locked_quantity'));
console.log();

console.log('8. Checking dependencies...');
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
  require('uuid');
  check('uuid is available', true);
} catch (e) {
  check('uuid is available', false, e.message);
}
console.log();

console.log('9. Checking server configuration...');
const serverIndexPath = path.join(__dirname, '../server/index.js');
const serverContent = fs.readFileSync(serverIndexPath, 'utf8');
check('server imports path', serverContent.includes("const path = require('path')"));
check('server has static file middleware', serverContent.includes('express.static'));
check('server imports storeRoutes', serverContent.includes("const storeRoutes = require('./routes/storeRoutes')"));
check('server imports productRoutes', serverContent.includes("const productRoutes = require('./routes/productRoutes')"));
check('server imports batchRoutes', serverContent.includes("const batchRoutes = require('./routes/batchRoutes')"));
check('server imports transferRoutes', serverContent.includes("const transferRoutes = require('./routes/transferRoutes')"));
check('server imports damageRoutes', serverContent.includes("const damageRoutes = require('./routes/damageRoutes')"));
check('server imports discountRoutes', serverContent.includes("const discountRoutes = require('./routes/discountRoutes')"));
check('server uses storeRoutes', serverContent.includes("app.use('/api/stores'"));
check('server uses productRoutes', serverContent.includes("app.use('/api/products'"));
check('server uses batchRoutes', serverContent.includes("app.use('/api/batches'"));
check('server uses transferRoutes', serverContent.includes("app.use('/api/transfers'"));
check('server uses damageRoutes', serverContent.includes("app.use('/api/damages'"));
check('server uses discountRoutes', serverContent.includes("app.use('/api/discounts'"));
console.log();

console.log('10. Checking core services implementation...');
const transferServicePath = path.join(__dirname, '../server/services/transferService.js');
const transferContent = fs.readFileSync(transferServicePath, 'utf8');
check('transferService has createTransferOrder', transferContent.includes('createTransferOrder'));
check('transferService has submitTransferOrder', transferContent.includes('submitTransferOrder'));
check('transferService has approveTransferOrder', transferContent.includes('approveTransferOrder'));
check('transferService has rejectTransferOrder', transferContent.includes('rejectTransferOrder'));
check('transferService has shipTransferOrder', transferContent.includes('shipTransferOrder'));
check('transferService has receiveTransferOrder', transferContent.includes('receiveTransferOrder'));

const batchServicePath = path.join(__dirname, '../server/services/batchService.js');
const batchContent = fs.readFileSync(batchServicePath, 'utf8');
check('batchService has getExpiringBatches', batchContent.includes('getExpiringBatches'));
check('batchService has getExpiredBatches', batchContent.includes('getExpiredBatches'));
check('batchService has getStoreInventory', batchContent.includes('getStoreInventory'));

const damageServicePath = path.join(__dirname, '../server/services/damageService.js');
const damageContent = fs.readFileSync(damageServicePath, 'utf8');
check('damageService has createDamageReport', damageContent.includes('createDamageReport'));
check('damageService has submitDamageReport', damageContent.includes('submitDamageReport'));
check('damageService has approveDamageReport', damageContent.includes('approveDamageReport'));

const discountServicePath = path.join(__dirname, '../server/services/discountService.js');
const discountContent = fs.readFileSync(discountServicePath, 'utf8');
check('discountService has createDiscountSale', discountContent.includes('createDiscountSale'));
check('discountService has activateDiscountSale', discountContent.includes('activateDiscountSale'));
check('discountService has deactivateDiscountSale', discountContent.includes('deactivateDiscountSale'));

const rollbackServicePath = path.join(__dirname, '../server/services/rollbackService.js');
const rollbackContent = fs.readFileSync(rollbackServicePath, 'utf8');
check('RollbackService has rollbackOperationByLog', rollbackContent.includes('rollbackOperationByLog'));
console.log();

console.log('11. Checking frontend features...');
const htmlPath = path.join(__dirname, '../public/index.html');
const htmlContent = fs.readFileSync(htmlPath, 'utf8');
check('Frontend has correct title', htmlContent.includes('连锁门店临期调拨系统'));
check('Frontend has dashboard tab', htmlContent.includes('dashboard-tab'));
check('Frontend has inventory tab', htmlContent.includes('inventory-tab'));
check('Frontend has batches tab', htmlContent.includes('batches-tab'));
check('Frontend has expiring tab', htmlContent.includes('expiring-tab'));
check('Frontend has transfers tab', htmlContent.includes('transfers-tab'));
check('Frontend has receiving tab', htmlContent.includes('receiving-tab'));
check('Frontend has discounts tab', htmlContent.includes('discounts-tab'));
check('Frontend has damages tab', htmlContent.includes('damages-tab'));
check('Frontend has stores tab', htmlContent.includes('stores-tab'));
check('Frontend has products tab', htmlContent.includes('products-tab'));
check('Frontend has audit tab', htmlContent.includes('audit-tab'));
check('Frontend has reports tab', htmlContent.includes('reports-tab'));

const appJsPath = path.join(__dirname, '../public/js/app.js');
const appJsContent = fs.readFileSync(appJsPath, 'utf8');
check('app.js has loadDashboard', appJsContent.includes('async loadDashboard()'));
check('app.js has loadStores', appJsContent.includes('async loadStores()'));
check('app.js has loadProducts', appJsContent.includes('async loadProducts()'));
check('app.js has loadInventory', appJsContent.includes('async loadInventory()'));
check('app.js has loadBatches', appJsContent.includes('async loadBatches()'));
check('app.js has loadExpiring', appJsContent.includes('async loadExpiring()'));
check('app.js has loadTransfers', appJsContent.includes('async loadTransfers()'));
check('app.js has loadDamages', appJsContent.includes('async loadDamages()'));
check('app.js has loadDiscounts', appJsContent.includes('async loadDiscounts()'));
check('app.js has submitTransfer', appJsContent.includes('async submitTransfer('));
check('app.js has approveTransfer', appJsContent.includes('async approveTransfer('));
check('app.js has rejectTransfer', appJsContent.includes('async rejectTransfer('));
check('app.js has shipTransfer', appJsContent.includes('async shipTransfer('));
check('app.js has receiveTransfer', appJsContent.includes('async receiveTransfer('));
check('app.js has searchAuditHistory', appJsContent.includes('async searchAuditHistory()'));
check('app.js has viewMyHistory', appJsContent.includes('async viewMyHistory()'));
check('app.js has replayOperation', appJsContent.includes('async replayOperation()'));
check('app.js has exportReport', appJsContent.includes('exportReport(type, format)'));
console.log();

console.log('12. Checking configuration...');
const envPath = path.join(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  check('.env has DB_HOST', envContent.includes('DB_HOST='));
  check('.env has DB_PORT', envContent.includes('DB_PORT='));
  check('.env has DB_NAME', envContent.includes('DB_NAME='));
  check('.env has DB_USER', envContent.includes('DB_USER='));
  check('.env has JWT_SECRET', envContent.includes('JWT_SECRET='));
  check('.env has REDIS_HOST', envContent.includes('REDIS_HOST='));
  check('.env has REDIS_PORT', envContent.includes('REDIS_PORT='));
} else {
  check('.env exists', false);
}
console.log();

console.log('13. Checking npm scripts...');
const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));
check('has start script', !!packageJson.scripts.start);
check('has test script', !!packageJson.scripts.test);
check('has db:init script', !!packageJson.scripts['db:init']);
check('has verify script', !!packageJson.scripts.verify);
console.log();

console.log('=== Summary ===');
if (allPassed) {
  console.log('\n✓ All checks passed! Chain Store Expiry Transfer System is ready to use.');
  console.log('\nCore Business Features:');
  console.log('  ✓ Store Management (门店管理)');
  console.log('  ✓ Product Management (商品管理)');
  console.log('  ✓ Batch Management (批次管理)');
  console.log('  ✓ Expiry Detection (临期检测)');
  console.log('  ✓ Transfer Orders (调拨单)');
  console.log('  ✓ Transfer Approval (调拨审批)');
  console.log('  ✓ Stock Locking (库存锁定)');
  console.log('  ✓ Receiving Confirmation (收货确认)');
  console.log('  ✓ Damage Reports (报损单)');
  console.log('  ✓ Damage Approval (报损审批)');
  console.log('  ✓ Discount Sales (折扣售卖)');
  console.log('  ✓ Audit Trail (审计追踪)');
  console.log('  ✓ Rollback (数据回滚)');
  console.log('  ✓ Report Export (报表导出)');
  console.log('\nNext steps:');
  console.log('  1. Ensure PostgreSQL and Redis are running');
  console.log('  2. Run: npm run db:init  (to initialize database)');
  console.log('  3. Run: npm start        (to start the server)');
  console.log('  4. Open: http://localhost:3000');
} else {
  console.log('\n✗ Some checks failed. Please review the issues above.');
  process.exit(1);
}
