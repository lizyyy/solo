const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const { v4: uuidv4 } = require('uuid');
const { detectSensitiveFields, maskSensitiveData } = require('../src/utils/maskUtils');

const dataDir = path.join(__dirname, '../data');
const dbPath = path.join(dataDir, 'database.db');

const initDatabase = (db) => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run(`CREATE TABLE IF NOT EXISTS environments (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        variables TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS requests (
        id TEXT PRIMARY KEY,
        environment_id TEXT,
        name TEXT NOT NULL,
        method TEXT NOT NULL,
        url TEXT NOT NULL,
        headers TEXT,
        body TEXT,
        sensitive_fields TEXT,
        status TEXT DEFAULT 'pending',
        created_by TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        request_hash TEXT,
        FOREIGN KEY (environment_id) REFERENCES environments(id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS responses (
        id TEXT PRIMARY KEY,
        request_id TEXT,
        status_code INTEGER,
        headers TEXT,
        body TEXT,
        response_time INTEGER,
        is_error BOOLEAN DEFAULT 0,
        error_message TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (request_id) REFERENCES requests(id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS sensitive_fields (
        id TEXT PRIMARY KEY,
        request_id TEXT,
        field_path TEXT NOT NULL,
        mask_type TEXT DEFAULT 'partial',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (request_id) REFERENCES requests(id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS favorites (
        id TEXT PRIMARY KEY,
        request_id TEXT,
        user_id TEXT,
        note TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (request_id) REFERENCES requests(id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS shared_records (
        id TEXT PRIMARY KEY,
        request_id TEXT,
        share_token TEXT UNIQUE,
        shared_by TEXT,
        permission_level TEXT DEFAULT 'view',
        expires_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (request_id) REFERENCES requests(id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS reviews (
        id TEXT PRIMARY KEY,
        request_id TEXT,
        reviewer_id TEXT,
        action TEXT NOT NULL,
        comment TEXT,
        previous_status TEXT,
        new_status TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (request_id) REFERENCES requests(id)
      )`);

      resolve();
    });
  });
};

const runQuery = (db, sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
};

const seedData = async () => {
  console.log('🌱 Starting seed data...\n');

  if (!fs.existsSync(dataDir)) {
    console.log('📁 Creating data directory...');
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const db = new sqlite3.Database(dbPath);

  try {
    console.log('🗄️  Initializing database tables...');
    await initDatabase(db);
    console.log('✅ Database tables initialized\n');

    const env1Id = uuidv4();
    const env2Id = uuidv4();
    
    console.log('📁 Creating environments...');
    await runQuery(db, 
      `INSERT OR IGNORE INTO environments (id, name, description, variables, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [env1Id, 'Development', 'Development environment', JSON.stringify({
        base_url: 'http://localhost:8080',
        api_key: 'dev-abc123'
      }), new Date().toISOString(), new Date().toISOString()]
    );

    await runQuery(db,
      `INSERT OR IGNORE INTO environments (id, name, description, variables, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [env2Id, 'Production', 'Production environment', JSON.stringify({
        base_url: 'https://api.example.com',
        api_key: 'prod-xyz789'
      }), new Date().toISOString(), new Date().toISOString()]
    );

    console.log('📋 Creating sample requests...');
    
    const req1Id = uuidv4();
    const req2Id = uuidv4();
    const req3Id = uuidv4();
    const req4Id = uuidv4();
    const req5Id = uuidv4();

    const headers1 = { 'Content-Type': 'application/json', 'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyIjoxfQ...' };
    const body1 = { username: 'john_doe', password: 'secret123' };
    const sensitive1 = detectSensitiveFields(headers1, body1);
    const maskedHeaders1 = maskSensitiveData(headers1, sensitive1.filter(f => f.field_path.startsWith('headers.')), 'headers');
    const maskedBody1 = maskSensitiveData(body1, sensitive1.filter(f => f.field_path.startsWith('body.')), 'body');

    await runQuery(db,
      `INSERT OR IGNORE INTO requests (id, name, method, url, headers, body, sensitive_fields, environment_id, created_by, status, request_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req1Id, 'User Login - Success', 'POST', '/api/auth/login',
        JSON.stringify(maskedHeaders1),
        JSON.stringify(maskedBody1),
        JSON.stringify(sensitive1), env1Id, 'developer_a', 'approved',
        'hash_' + req1Id.substring(0, 8)
      ]
    );

    const headers2 = { 'Content-Type': 'application/json', 'X-API-Key': 'abcdefghijklmnopqrstuvwxyz' };
    const body2 = { username: 'john_doe', password: 'wrongpass' };
    const sensitive2 = detectSensitiveFields(headers2, body2);
    const maskedHeaders2 = maskSensitiveData(headers2, sensitive2.filter(f => f.field_path.startsWith('headers.')), 'headers');
    const maskedBody2 = maskSensitiveData(body2, sensitive2.filter(f => f.field_path.startsWith('body.')), 'body');

    await runQuery(db,
      `INSERT OR IGNORE INTO requests (id, name, method, url, headers, body, sensitive_fields, environment_id, created_by, status, request_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req2Id, 'User Login - Failure (Wrong Password)', 'POST', '/api/auth/login',
        JSON.stringify(maskedHeaders2),
        JSON.stringify(maskedBody2),
        JSON.stringify(sensitive2), env1Id, 'developer_b', 'rejected',
        'hash_' + req2Id.substring(0, 8)
      ]
    );

    const headers3 = { 'Accept': 'application/json' };
    const body3 = {};
    const sensitive3 = detectSensitiveFields(headers3, body3);

    await runQuery(db,
      `INSERT OR IGNORE INTO requests (id, name, method, url, headers, body, sensitive_fields, environment_id, created_by, status, request_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req3Id, 'Get User Profile', 'GET', '/api/users/123',
        JSON.stringify(headers3),
        JSON.stringify(body3),
        JSON.stringify(sensitive3), env1Id, 'developer_a', 'reviewing',
        'hash_' + req3Id.substring(0, 8)
      ]
    );

    const headers4 = { 'Content-Type': 'application/json', 'X-Signature': 'sha256=abc123...' };
    const body4 = { 
      amount: 99.99, 
      currency: 'USD',
      api_secret: 'whsec_test12345',
      private_key: '-----BEGIN PRIVATE KEY-----\nMIIE...',
      nested: {
        auth_token: 'nested_token_12345',
        credentials: {
          password: 'nested_secret'
        }
      }
    };
    const sensitive4 = detectSensitiveFields(headers4, body4);
    const maskedHeaders4 = maskSensitiveData(headers4, sensitive4.filter(f => f.field_path.startsWith('headers.')), 'headers');
    const maskedBody4 = maskSensitiveData(body4, sensitive4.filter(f => f.field_path.startsWith('body.')), 'body');

    await runQuery(db,
      `INSERT OR IGNORE INTO requests (id, name, method, url, headers, body, sensitive_fields, environment_id, created_by, status, request_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req4Id, 'Payment Webhook - Test', 'POST', '/api/webhook/payment',
        JSON.stringify(maskedHeaders4),
        JSON.stringify(maskedBody4),
        JSON.stringify(sensitive4), env2Id, 'developer_c', 'pending',
        'hash_' + req4Id.substring(0, 8)
      ]
    );

    const headers5 = { 'Accept': 'application/json' };
    const body5 = {};
    const sensitive5 = detectSensitiveFields(headers5, body5);

    await runQuery(db,
      `INSERT OR IGNORE INTO requests (id, name, method, url, headers, body, sensitive_fields, environment_id, created_by, status, request_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req5Id, 'List Products', 'GET', '/api/products?page=1&limit=20',
        JSON.stringify(headers5),
        JSON.stringify(body5),
        JSON.stringify(sensitive5), env1Id, 'developer_a', 'archived',
        'hash_' + req5Id.substring(0, 8)
      ]
    );

    console.log('📝 Creating sample responses...');
    
    await runQuery(db,
      `INSERT OR IGNORE INTO responses (id, request_id, status_code, headers, body, response_time, is_error, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        uuidv4(), req1Id, 200,
        JSON.stringify({ 'Content-Type': 'application/json' }),
        JSON.stringify({ success: true, token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...', user: { id: 1, username: 'john_doe' } }),
        156, 0, new Date().toISOString()
      ]
    );

    await runQuery(db,
      `INSERT OR IGNORE INTO responses (id, request_id, status_code, headers, body, response_time, is_error, error_message, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        uuidv4(), req2Id, 401,
        JSON.stringify({ 'Content-Type': 'application/json' }),
        JSON.stringify({ error: 'Invalid credentials', code: 'AUTH_FAILED' }),
        89, 1, 'Invalid username or password', new Date().toISOString()
      ]
    );

    await runQuery(db,
      `INSERT OR IGNORE INTO responses (id, request_id, status_code, headers, body, response_time, is_error, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        uuidv4(), req3Id, 200,
        JSON.stringify({ 'Content-Type': 'application/json' }),
        JSON.stringify({ id: 123, username: 'john_doe', email: 'john@example.com', created_at: '2024-01-15T10:30:00Z' }),
        42, 0, new Date().toISOString()
      ]
    );

    await runQuery(db,
      `INSERT OR IGNORE INTO responses (id, request_id, status_code, headers, body, response_time, is_error, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        uuidv4(), req3Id, 200,
        JSON.stringify({ 'Content-Type': 'application/json' }),
        JSON.stringify({ id: 123, username: 'john_doe_updated', email: 'john@example.com', profile_complete: true }),
        38, 0, new Date(Date.now() - 3600000).toISOString()
      ]
    );

    await runQuery(db,
      `INSERT OR IGNORE INTO responses (id, request_id, status_code, headers, body, response_time, is_error, error_message, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        uuidv4(), req4Id, 500,
        JSON.stringify({ 'Content-Type': 'application/json' }),
        JSON.stringify({ error: 'Internal Server Error' }),
        2500, 1, 'Database connection timeout', new Date().toISOString()
      ]
    );

    console.log('👀 Creating review history...');
    
    await runQuery(db,
      `INSERT OR IGNORE INTO reviews (id, request_id, reviewer_id, action, comment, previous_status, new_status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        uuidv4(), req1Id, 'team_lead', 'status_change',
        'Request tested and verified - no sensitive data exposure',
        'reviewing', 'approved', new Date(Date.now() - 7200000).toISOString()
      ]
    );

    await runQuery(db,
      `INSERT OR IGNORE INTO reviews (id, request_id, reviewer_id, action, comment, previous_status, new_status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        uuidv4(), req1Id, 'team_lead', 'status_change',
        'Initial review started',
        'pending', 'reviewing', new Date(Date.now() - 86400000).toISOString()
      ]
    );

    await runQuery(db,
      `INSERT OR IGNORE INTO reviews (id, request_id, reviewer_id, action, comment, previous_status, new_status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        uuidv4(), req2Id, 'security_officer', 'status_change',
        'Rejected - contains plaintext password in body, recommend using secure transport',
        'reviewing', 'rejected', new Date(Date.now() - 3600000).toISOString()
      ]
    );

    await runQuery(db,
      `INSERT OR IGNORE INTO reviews (id, request_id, reviewer_id, action, comment, previous_status, new_status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        uuidv4(), req3Id, 'qa_engineer', 'status_change',
        'QA review in progress - checking response format consistency',
        'pending', 'reviewing', new Date(Date.now() - 1800000).toISOString()
      ]
    );

    console.log('⭐ Creating favorites...');
    
    await runQuery(db,
      `INSERT OR IGNORE INTO favorites (id, request_id, user_id, note, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      [uuidv4(), req1Id, 'developer_a', 'Good reference for successful auth flow', new Date().toISOString()]
    );

    await runQuery(db,
      `INSERT OR IGNORE INTO favorites (id, request_id, user_id, note, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      [uuidv4(), req3Id, 'developer_b', 'Profile endpoint - use in frontend integration', new Date().toISOString()]
    );

    console.log('🔗 Creating shared records...');
    
    await runQuery(db,
      `INSERT OR IGNORE INTO shared_records (id, request_id, share_token, shared_by, permission_level, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [uuidv4(), req1Id, 'share_token_abc123', 'team_lead', 'view', new Date().toISOString()]
    );

    console.log('\n✅ Seed data completed successfully!');
    console.log('\n📊 Summary:');
    console.log('  - Environments: 2');
    console.log('  - Requests: 5');
    console.log('  - Responses: 5 (including error and multiple versions)');
    console.log('  - Reviews: 4 (showing status transitions)');
    console.log('  - Favorites: 2');
    console.log('  - Shares: 1');
    console.log('\n🎯 Example scenarios:');
    console.log('  1. Successful request (approved)');
    console.log('  2. Failed request with error (rejected)');
    console.log('  3. Request with multiple responses (reviewing)');
    console.log('  4. Pending request awaiting review');
    console.log('  5. Archived request');
    console.log('\n');

  } catch (error) {
    console.error('❌ Seed failed:', error);
    throw error;
  } finally {
    db.close();
  }
};

seedData()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  });
