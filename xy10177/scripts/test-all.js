const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '../data');
const dbPath = path.join(dataDir, 'meeting-room.db');

function cleanupDatabase() {
  if (fs.existsSync(dbPath)) {
    console.log('[Test] Cleaning up database...');
    fs.unlinkSync(dbPath);
  }
  const walFile = dbPath + '-wal';
  if (fs.existsSync(walFile)) {
    fs.unlinkSync(walFile);
  }
  const shmFile = dbPath + '-shm';
  if (fs.existsSync(shmFile)) {
    fs.unlinkSync(shmFile);
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function waitForServer(port = 3000, timeout = 30000) {
  const http = require('http');
  const startTime = Date.now();
  
  return new Promise((resolve, reject) => {
    function check() {
      const req = http.get(`http://localhost:${port}/health`, (res) => {
        if (res.statusCode === 200) {
          resolve(true);
        } else {
          if (Date.now() - startTime < timeout) {
            setTimeout(check, 500);
          } else {
            reject(new Error('Server not ready'));
          }
        }
      });
      
      req.on('error', () => {
        if (Date.now() - startTime < timeout) {
          setTimeout(check, 500);
        } else {
          reject(new Error('Server not ready'));
        }
      });
      
      req.end();
    }
    check();
  });
}

async function runTests() {
  console.log('========================================');
  console.log('会议室资源冲突 API - 测试套件');
  console.log('========================================');
  console.log('');

  let server = null;
  let testsPassed = 0;
  let testsFailed = 0;

  try {
    console.log('[Setup] Cleaning up old database...');
    cleanupDatabase();

    console.log('[Setup] Starting server on port 3001 with callback scheduler (3s interval)...');
    server = spawn('node', ['src/server.js'], {
      cwd: path.join(__dirname, '..'),
      env: { ...process.env, PORT: '3001', CALLBACK_SCHEDULER_INTERVAL: '3000' },
    });

    server.stdout.on('data', (data) => {
      console.log(`[Server] ${data.toString().trim()}`);
    });

    server.stderr.on('data', (data) => {
      console.error(`[Server Error] ${data.toString().trim()}`);
    });

    await waitForServer(3001, 15000);
    console.log('[Setup] Server is ready');
    console.log('');

    const { runApiTests } = require('./api-tests');
    const results = await runApiTests();
    
    testsPassed = results.passed;
    testsFailed = results.failed;

    console.log('');
    console.log('========================================');
    console.log(`测试完成: ${testsPassed} 通过, ${testsFailed} 失败`);
    console.log('========================================');

    if (testsFailed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('[Test Error]', err.message);
    console.error(err.stack);
    process.exit(1);
  } finally {
    if (server) {
      console.log('[Teardown] Stopping server...');
      server.kill();
    }
  }
}

runTests();
