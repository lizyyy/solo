// 稳定启动脚本：每次确保在端口并持久化
const { execSync, spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

function check(port) {
  return new Promise(resolve => {
    const req = http.get(`http://localhost:${port}/api/health`, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve({ok: true, body: d}));
    });
    req.on('error', () => resolve({ok: false}));
    req.setTimeout(2000, () => req.destroy());
  });
}

(async function main() {
  const PROJECT = process.cwd();
  let r = await check(3000);
  if (!r.ok) {
    console.log('服务未启动，启动中...');
    try { execSync('pkill -9 -f "node server.js" 2>/dev/null || true'); } catch(e) {}
    await new Promise(res => setTimeout(res, 800));
    const proc = spawn('node', ['server.js'], {
      cwd: PROJECT, detached: true, stdio: ['ignore', 'pipe', 'pipe']
    });
    let log = '';
    proc.stdout.on('data', d => log += d.toString());
    proc.stderr.on('data', d => log += d.toString());
    proc.unref();
    for (let i=0; i<10; i++) {
      await new Promise(res => setTimeout(res, 500));
      const rr = await check(3000);
      if (rr.ok) { console.log('启动成功', rr.body); break; }
    }
  } else {
    console.log('服务已在运行', r.body);
  }
})();
