const fs = require('fs');
const path = require('path');

const PATHS = [
  '/api/users',
  '/api/orders',
  '/api/products',
  '/api/auth/login',
  '/api/auth/refresh',
  '/api/dashboard/stats',
  '/api/reports/generate'
];

const TENANTS = ['tenant_001', 'tenant_002', 'tenant_003', ''];
const STATUSES = [200, 200, 200, 201, 400, 401, 404, 500];

function generateLatency(pathName, status) {
  let baseMs;
  
  if (pathName.includes('generate') || pathName.includes('stats')) {
    baseMs = 1000 + Math.random() * 3000;
  } else if (pathName.includes('login')) {
    baseMs = 500 + Math.random() * 1000;
  } else {
    baseMs = 50 + Math.random() * 300;
  }
  
  if (status >= 400) {
    baseMs *= 0.5;
  }
  
  if (Math.random() < 0.05) {
    baseMs *= 3 + Math.random() * 5;
  }
  
  return Math.round(baseMs);
}

function generateLogEntry(index) {
  const path = PATHS[Math.floor(Math.random() * PATHS.length)];
  const tenant = TENANTS[Math.floor(Math.random() * TENANTS.length)];
  const status = STATUSES[Math.floor(Math.random() * STATUSES.length)];
  const latency = generateLatency(path, status);
  const requestId = `req_${Math.random().toString(36).substr(2, 12)}`;
  const timestamp = Date.now() - Math.floor(Math.random() * 86400000);
  
  return JSON.stringify({
    path,
    tenant,
    status,
    latency,
    request_id: requestId,
    timestamp
  });
}

const logsDir = path.join(__dirname, '..', 'logs');
const logFile = path.join(logsDir, 'access.log');

const lines = [];
const numLines = 500;

for (let i = 0; i < numLines; i++) {
  lines.push(generateLogEntry(i));
}

lines.push('这是一行坏数据');
lines.push('{ invalid json: true ');
lines.push('{"path": "/api/test", "latency": "not_a_number"}');

lines.splice(100, 0, lines[50]);
lines.splice(200, 0, lines[75]);

fs.writeFileSync(logFile, lines.join('\n'), 'utf8');

console.log(`✅ 生成了 ${numLines + 5} 条日志到: ${logFile}`);
console.log(`   包含: ${numLines} 条正常日志, 3 条坏行, 2 条重复`);
