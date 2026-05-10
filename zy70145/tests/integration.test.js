const http = require('http');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:3000';
const TEST_DB = path.join(__dirname, '..', 'test_slow_query.db');

function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json'
      }
    };
    
    if (body) {
      options.headers['Content-Length'] = Buffer.byteLength(JSON.stringify(body));
    }
    
    const req = http.request(`${BASE_URL}${path}`, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = data ? JSON.parse(data) : {};
          resolve({ status: res.statusCode, body: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    
    req.on('error', reject);
    
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${expected}, got ${actual}`);
  }
  console.log(`  ✓ ${message}`);
}

function assertTruthy(value, message) {
  if (!value) {
    throw new Error(`${message}: expected truthy, got ${value}`);
  }
  console.log(`  ✓ ${message}`);
}

async function runTests() {
  console.log('\n=== Slow Query Tracker Integration Tests ===\n');
  
  try {
    const healthRes = await request('GET', '/health');
    assertEqual(healthRes.status, 200, 'Health check returns 200');
    assertEqual(healthRes.body.status, 'ok', 'Health status is ok');
    
    console.log('\n--- Test 1: Create Owners ---');
    const owner1Res = await request('POST', '/api/owners', {
      name: 'zhangsan',
      email: 'zhangsan@example.com'
    });
    assertEqual(owner1Res.status, 200, 'Create owner zhangsan returns 200');
    assertTruthy(owner1Res.body.data && owner1Res.body.data.id, 'Owner has id');
    const owner1Id = owner1Res.body.data.id;
    
    const owner2Res = await request('POST', '/api/owners', {
      name: 'lisi',
      email: 'lisi@example.com'
    });
    assertEqual(owner2Res.status, 200, 'Create owner lisi returns 200');
    const owner2Id = owner2Res.body.data.id;
    
    console.log('\n--- Test 2: Ingest Slow Queries ---');
    const query1 = {
      sql: "SELECT * FROM users WHERE id = 1 AND status = 'active'",
      execution_time: 2500,
      source: 'app-server-01',
      database_name: 'production_db'
    };
    
    const ingest1Res = await request('POST', '/api/slow-queries/ingest', query1);
    assertEqual(ingest1Res.status, 200, 'Ingest single query returns 200');
    assertTruthy(ingest1Res.body.data.queryId, 'Query has id');
    assertTruthy(ingest1Res.body.data.fingerprintId, 'Query has fingerprint');
    assertEqual(ingest1Res.body.data.isNewFingerprint, true, 'First query creates new fingerprint');
    const fingerprint1Id = ingest1Res.body.data.fingerprintId;
    
    const query2 = {
      sql: "SELECT * FROM users WHERE id = 42 AND status = 'inactive'",
      execution_time: 3800,
      source: 'app-server-02'
    };
    
    const ingest2Res = await request('POST', '/api/slow-queries/ingest', query2);
    assertEqual(ingest2Res.status, 200, 'Ingest similar query returns 200');
    assertEqual(ingest2Res.body.data.fingerprintId, fingerprint1Id, 'Similar queries share same fingerprint');
    assertEqual(ingest2Res.body.data.isNewFingerprint, false, 'Second query reuses fingerprint');
    
    const batchQueries = [
      {
        sql: "SELECT * FROM orders WHERE user_id = 100 AND created_at > '2024-01-01'",
        execution_time: 5200,
        source: 'batch-server-01'
      },
      {
        sql: "SELECT * FROM orders WHERE user_id = 200 AND created_at > '2024-02-01'",
        execution_time: 4100,
        source: 'batch-server-02'
      }
    ];
    
    const batchRes = await request('POST', '/api/slow-queries/ingest/batch', { queries: batchQueries });
    assertEqual(batchRes.status, 200, 'Batch ingest returns 200');
    assertEqual(batchRes.body.data.success, 2, 'Batch processes all queries');
    
    console.log('\n--- Test 3: List Fingerprints ---');
    const listRes = await request('GET', '/api/fingerprints');
    assertEqual(listRes.status, 200, 'List fingerprints returns 200');
    assertTruthy(listRes.body.data.length >= 2, 'Has at least 2 fingerprints');
    
    console.log('\n--- Test 4: Claim Fingerprint ---');
    const claimRes = await request('POST', `/api/fingerprints/${fingerprint1Id}/claim`, {
      owner_id: owner1Id,
      note: 'This is my responsibility'
    });
    assertEqual(claimRes.status, 200, 'Claim returns 200');
    assertEqual(claimRes.body.data.status, 'claimed', 'Status is claimed');
    
    const detailRes = await request('GET', `/api/fingerprints/${fingerprint1Id}`);
    assertEqual(detailRes.status, 200, 'Get fingerprint detail returns 200');
    assertEqual(detailRes.body.data.owner_id, owner1Id, 'Fingerprint has correct owner');
    assertEqual(detailRes.body.data.status, 'claimed', 'Fingerprint status is claimed');
    assertTruthy(detailRes.body.data.history.length > 0, 'Has status history');
    
    console.log('\n--- Test 5: Create Optimization ---');
    const optimizeRes = await request('POST', `/api/fingerprints/${fingerprint1Id}/optimize`, {
      owner_id: owner1Id,
      before_sql: "SELECT * FROM users WHERE id = ?",
      after_sql: "SELECT id, name, email FROM users WHERE id = ?",
      description: 'Added covering index and limited columns'
    });
    assertEqual(optimizeRes.status, 200, 'Create optimization returns 200');
    const optimizationId = optimizeRes.body.data.optimizationId;
    
    const detailAfterOpt = await request('GET', `/api/fingerprints/${fingerprint1Id}`);
    assertEqual(detailAfterOpt.body.data.status, 'in_progress', 'Status updated to in_progress');
    assertEqual(detailAfterOpt.body.data.optimizations.length, 1, 'Has optimization record');
    
    console.log('\n--- Test 6: Record Rerun with Improvement ---');
    const rerunRes = await request('POST', `/api/optimizations/${optimizationId}/reruns`, {
      before_time: 2500,
      after_time: 250,
      environment: 'staging',
      notes: 'Tested with same dataset'
    });
    assertEqual(rerunRes.status, 200, 'Record rerun returns 200');
    assertEqual(rerunRes.body.data.status, 'improved', 'Status is improved');
    assertTruthy(rerunRes.body.data.improvementPercent > 0, 'Has positive improvement');
    
    const detailAfterRerun = await request('GET', `/api/fingerprints/${fingerprint1Id}`);
    assertEqual(detailAfterRerun.body.data.status, 'verified', 'Fingerprint verified after improvement');
    
    console.log('\n--- Test 7: Generate Weekly Report ---');
    const reportRes = await request('GET', '/api/reports/weekly');
    assertEqual(reportRes.status, 200, 'Generate report returns 200');
    assertTruthy(reportRes.body.data.period, 'Report has period');
    assertTruthy(reportRes.body.data.summary, 'Report has summary');
    assertTruthy(reportRes.body.data.summary.totalSlowQueries > 0, 'Report counts queries');
    assertTruthy(reportRes.body.data.statusBreakdown, 'Report has status breakdown');
    assertTruthy(reportRes.body.data.topFingerprints, 'Report has top fingerprints');
    
    console.log('\n--- Test 8: Invalid Query (Exception Handling) ---');
    const invalidRes = await request('POST', '/api/slow-queries/ingest', {
      sql: '',
      execution_time: -5
    });
    assertEqual(invalidRes.status, 400, 'Invalid query returns 400');
    
    const exceptionsRes = await request('GET', '/api/operations/exceptions/unresolved');
    assertEqual(exceptionsRes.status, 200, 'Get exceptions returns 200');
    assertTruthy(exceptionsRes.body.data.length > 0, 'Has recorded exception');
    
    console.log('\n--- Test 9: Pending Tasks ---');
    const tasksRes = await request('GET', '/api/operations/tasks/pending');
    assertEqual(tasksRes.status, 200, 'Get pending tasks returns 200');
    assertTruthy(tasksRes.body.data.length > 0, 'Has pending tasks (fingerprint analysis)');
    
    console.log('\n--- Test 10: Owner Listing ---');
    const ownersRes = await request('GET', '/api/owners');
    assertEqual(ownersRes.status, 200, 'List owners returns 200');
    assertTruthy(ownersRes.body.data.length >= 2, 'Has at least 2 owners');
    
    console.log('\n=== All Tests Passed ===\n');
    
  } catch (e) {
    console.error('\n✗ Test Failed:', e.message);
    console.error(e.stack);
    process.exit(1);
  }
}

if (require.main === module) {
  if (fs.existsSync(TEST_DB)) {
    fs.unlinkSync(TEST_DB);
  }
  
  runTests();
}

module.exports = { request };
